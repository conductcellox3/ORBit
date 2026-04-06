use tauri::command;
use serde::Serialize;
use windows::core::HSTRING;
use windows::Storage::StorageFile;
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use std::path::Path;

#[derive(Serialize)]
pub struct OcrResult {
    pub text: String,
    pub status: String,
}

#[command]
pub async fn run_local_ocr(image_path: String) -> Result<OcrResult, String> {
    if !Path::new(&image_path).exists() {
        return Err(format!("File not found: {}", image_path));
    }

    // Use Windows Native OCR (Windows.Media.Ocr)
    // Run blocking calls on tokio blocking thread if needed, but since it's async we can await.
    match perform_windows_ocr(&image_path).await {
        Ok(text) => {
            if text.trim().is_empty() {
                Ok(OcrResult {
                    text: "".to_string(),
                    status: "ready".to_string(), // Empty text is considered "ready", not failed
                })
            } else {
                Ok(OcrResult {
                    text,
                    status: "ready".to_string(),
                })
            }
        }
        Err(e) => {
            Err(format!("Windows OCR Error: {:?}", e))
        }
    }
}

async fn perform_windows_ocr(path: &str) -> windows::core::Result<String> {
    let hstring_path = HSTRING::from(path);
    
    // 1. Get StorageFile from path (Native Windows path required)
    let file = StorageFile::GetFileFromPathAsync(&hstring_path)?.get()?;
    
    // 2. Open file stream
    let stream = file.OpenReadAsync()?.get()?;
    
    // 3. Create BitmapDecoder
    let decoder = BitmapDecoder::CreateAsync(&stream)?.get()?;
    
    // 4. Get SoftwareBitmap
    let bitmap = decoder.GetSoftwareBitmapAsync()?.get()?;
    
    // 5. Build OCR Engine (defaults to system language, handles Japanese/English mix well)
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .or_else(|_| OcrEngine::TryCreateFromLanguage(&windows::Globalization::Language::CreateLanguage(&HSTRING::from("ja-JP"))?))?;

    // 6. Recognize text
    let result = engine.RecognizeAsync(&bitmap)?.get()?;
    
    let text = result.Text()?;
    Ok(text.to_string())
}
