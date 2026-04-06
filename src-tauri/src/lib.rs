// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod capture;
mod ocr;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_exe_dir() -> Result<String, String> {
    let mut path = std::env::current_exe().map_err(|e| e.to_string())?;
    path.pop(); // Remove the executable file name, leaving the directory
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_exe_dir,
            capture::start_capture_session,
            capture::finish_capture_session,
            capture::cancel_capture_session,
            capture::fixed_region_capture,
            ocr::run_local_ocr
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
