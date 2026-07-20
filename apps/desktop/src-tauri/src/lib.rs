// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri_plugin_sql::{
    Migration,
    MigrationKind
};

const DATABASE_URL: &str = "sqlite:argin-accounting.db";

fn database_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initialize_database",
            sql: include_str!(
                "../migrations/0001_initialize_database.sql"
            ),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "company_and_branch",
            sql: include_str!(
                "../migrations/0002_company_and_branch.sql"
            ),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "fiscal_management",
            sql: include_str!(
                "../migrations/0003_fiscal_management.sql"
            ),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "security",
            sql: include_str!(
                "../migrations/0004_security.sql"
            ),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    DATABASE_URL,
                    database_migrations()
                )
                .build()
        )
        .run(tauri::generate_context!())
        .expect("error while running ArginAccounting");
}
