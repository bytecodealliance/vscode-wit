use lazy_regex::lazy_regex;
use tower_lsp::lsp_types::{Diagnostic, Range, Position, DiagnosticSeverity, Url};
use std::{
    ffi::OsStr,
    process::Stdio, collections::HashMap, path::Path,
};

use tokio::process::Command;

pub struct Linter {
    cmd: Command,
}

impl Linter {
    pub fn new(path: impl AsRef<OsStr>) -> Self {
        let mut cmd = Command::new("wasm-tools");
        cmd.arg("component");
        cmd.arg("wit");
        cmd.arg(Path::new(&path).parent().unwrap_or(Path::new(&path)));
        cmd.stderr(Stdio::piped());
        cmd.stdout(Stdio::piped());

        Self { cmd }
    }

    pub async fn run(&mut self) -> std::io::Result<HashMap<Url, Vec<Diagnostic>>> {
        let child = self.cmd.spawn()?;
        let output = child.wait_with_output().await?;

        if let Ok(stderr) = String::from_utf8(output.stderr) {
            Ok(ouput_from_str(stderr))
        } else {
            Ok(HashMap::new())
        }
    }
}


fn ouput_from_str(s: String) -> HashMap<Url, Vec<Diagnostic>> {
        let regex = lazy_regex!(r":(.*)\s*-->\s*(.*):(\d+):(\d+)\s.*\s.*\s.*(\^\-*)"m);
        let mut hashmap = HashMap::new();

    for cap in regex.captures_iter(&s) {
        let message = cap[1].to_string();
        let file = &cap[2];
        let line = cap[3].parse::<u32>().unwrap_or_default();
        let character = cap[4].parse::<u32>().unwrap_or_default();
        let marker = cap[5].to_string();

        let cwd = std::env::current_dir().unwrap();
        let path = cwd.join(file);
        let uri = Url::from_file_path(path).unwrap();

        hashmap.insert(uri, vec![Diagnostic {
            range: Range {
                start: Position {
                    line: line - 1,
                    character: character - 1,
                },
                end: Position {
                    line: line - 1,
                    character: character - 1 + marker.len() as u32,
                },
            },
            severity: Some(DiagnosticSeverity::ERROR),
            message,
            ..Default::default()
        }]);
    }

    hashmap
}