use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn search_artwork(search: String, storefront: String, kind: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    if kind == "album" || kind == "movie" {
        let body = serde_json::json!({
            "search": search,
            "storefront": storefront,
            "type": kind
        });
        let res = client
            .post("https://artwork.dodoapps.io/")
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        return res.text().await.map_err(|e| e.to_string());
    }

    let url = format!(
        "https://itunes.apple.com/search?term={}&country={}&entity={}&limit=50",
        urlencoding::encode(&search),
        urlencoding::encode(&storefront),
        urlencoding::encode(&kind)
    );
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let mut images = Vec::new();
    if let Some(results) = data["results"].as_array() {
        for r in results {
            let artwork = r["artworkUrl100"].as_str().unwrap_or_default();
            if artwork.is_empty() {
                continue;
            }
            let name = r["collectionName"]
                .as_str()
                .or(r["trackName"].as_str())
                .unwrap_or("Unknown");
            let artist = r["artistName"].as_str().unwrap_or("");
            let thumb = artwork
                .rsplit_once('/')
                .map(|(base, _)| format!("{}/600x600bb.jpg", base))
                .unwrap_or_else(|| artwork.to_string());
            let large = artwork
                .replace("/image/thumb/", "/us/r1000/0/")
                .rsplit_once('/')
                .map(|(base, _)| base.to_string())
                .unwrap_or_else(|| artwork.to_string());

            images.push(serde_json::json!({
                "name": name,
                "artist": artist,
                "thumb": thumb,
                "large": large
            }));
        }
    }

    Ok(serde_json::json!({ "images": images }).to_string())
}

#[tauri::command]
async fn copy_image(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    let tauri_img = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
    app.clipboard()
        .write_image(&tauri_img)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn prepare_drag_image(url: String, filename: String) -> Result<String, String> {
    let dir = std::env::temp_dir().join("itunes-artwork-fetcher");
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    let path = dir.join(&filename);

    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    tokio::fs::write(&path, &bytes).await.map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn save_image(app: tauri::AppHandle, url: String, filename: String) -> Result<(), String> {
    let path = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .add_filter("JPEG Image", &["jpg", "jpeg"])
        .add_filter("All Files", &["*"])
        .blocking_save_file()
        .ok_or("Save cancelled")?;

    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    tokio::fs::write(path.as_path().ok_or("Invalid path")?, &bytes)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_drag::init())
        .invoke_handler(tauri::generate_handler![search_artwork, copy_image, prepare_drag_image, save_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
