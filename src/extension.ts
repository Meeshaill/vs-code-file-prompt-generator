import * as vscode from "vscode";
import { FileDataProvider } from "./fileExplorer";
import * as path from "path";

let fileDataProvider: FileDataProvider;

export function activate(context: vscode.ExtensionContext) {
    fileDataProvider = new FileDataProvider(context);

    vscode.window.createTreeView("fileSelectorView", {
        treeDataProvider: fileDataProvider,
    });

    const toggleSelectionCommand = vscode.commands.registerCommand(
        "file-selector.toggleSelection",
        (node) => {
            if (node && node.file) {
                fileDataProvider.toggleSelection(node.file.uri);
            }
        },
    );

    const exportCommand = vscode.commands.registerCommand(
        "file-selector.exportSelected",
        async () => {
            await exportSelectedFiles();
        },
    );

    context.subscriptions.push(toggleSelectionCommand, exportCommand);
}

// Hilfsfunktion, um ein Unterverzeichnis im Array zu finden oder anzulegen
function findOrCreateSubdir(arr: any[], dirName: string): any[] {
    // Wir suchen in arr nach einem Objekt vom Format { "dirName": [] }
    for (const item of arr) {
        if (typeof item === "object" && item.hasOwnProperty(dirName)) {
            return item[dirName];
        }
    }
    // Wenn nicht gefunden, neu anlegen
    const newDir = { [dirName]: [] };
    arr.push(newDir);
    return newDir[dirName];
}

// Rekursive Funktion, um eine Datei in die Struktur einzufügen
function insertFileIntoStructure(structure: any, parts: string[]) {
    // Wenn keine parts, nichts zu tun
    if (parts.length === 0) return;

    const current = parts[0];
    const isLast = parts.length === 1;

    // Wenn wir im Root-Bereich sind, ist structure ein Objekt
    // Wenn current ein Verzeichnis ist, müssen wir ein Array anlegen oder nutzen
    // Wenn isLast ist, haben wir eine Datei

    // Top-Level: Wir sind im 'structure' Objekt.
    // Wenn parts.length > 1, ist current ein Verzeichnis.
    // Wenn parts.length == 1, ist current eine Datei im Root, dann legen wir z.B. unter "." ein Array an.

    if (parts.length === 1) {
        // Eine einzelne Komponente bedeutet: Datei im Root?
        // Falls Dateien im Root vorhanden sind, legen wir sie unter "." ab
        const fileName = current;
        if (!structure["."]) {
            structure["."] = [];
        }
        structure["."].push(fileName);
        return;
    }

    // Mehrere Teile: current ist ein Verzeichnis
    const dirName = current;
    // Prüfen ob dieses Verzeichnis bereits existiert
    if (!structure[dirName]) {
        // Legen wir ein Array für dieses Verzeichnis an
        structure[dirName] = [];
    }

    // In dieses Verzeichnis-Array fügen wir nun den Rest des Pfades ein
    // Wenn wir noch weitere Teile haben, müssen wir tiefer gehen
    const subParts = parts.slice(1);
    if (subParts.length === 1) {
        // Nächster Teil ist eine Datei
        const fileName = subParts[0];
        structure[dirName].push(fileName);
    } else {
        // Nächster Teil ist wieder ein Verzeichnis
        // Wir müssen rekursiv ein Unterverzeichnis-Objekt finden/erstellen
        const nextDir = subParts[0];
        const remainder = subParts.slice(1);

        // nextDir soll als { "nextDir": [] } Objekt im dirName-Array eingefügt werden
        const subdirArray = findOrCreateSubdir(structure[dirName], nextDir);

        // remainder weiter rekursiv einfügen
        if (remainder.length === 1) {
            // Datei einfügen
            subdirArray.push(remainder[0]);
        } else {
            // weitere Verzeichnisse
            insertNestedDir(subdirArray, remainder);
        }
    }
}

// Hilfsfunktion für tiefer geschachtelte Verzeichnisse
function insertNestedDir(arr: any[], parts: string[]) {
    // parts hat mindestens 2 Elemente (Verzeichnis + entweder weitere Verzeichnisse oder Datei)
    const current = parts[0];
    const remainder = parts.slice(1);
    const isLast = remainder.length === 0;

    if (isLast) {
        // Nur eine Komponente: Datei
        arr.push(current);
        return;
    }

    // current ist ein Verzeichnis
    const subdirArray = findOrCreateSubdir(arr, current);

    if (remainder.length === 1) {
        // remainder ist eine Datei
        subdirArray.push(remainder[0]);
    } else {
        // Noch mehr Ebenen
        insertNestedDir(subdirArray, remainder);
    }
}

async function exportSelectedFiles() {
    const selected = fileDataProvider.getSelectedFiles();
    const allFiles = fileDataProvider.getAllFiles();

    if (
        !vscode.workspace.workspaceFolders ||
        vscode.workspace.workspaceFolders.length === 0
    ) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

    // Hierarchische Struktur aufbauen
    const structure: any = {};

    for (const f of allFiles) {
        const relPath = path.relative(workspaceFolder, f.uri.fsPath).replace(
            /\\/g,
            "/",
        );
        const parts = relPath.split("/");

        // Wenn der Pfad nur eine Komponente hat, ist es eine Datei im Root
        if (parts.length === 1) {
            // Datei im Root
            if (!structure["."]) {
                structure["."] = [];
            }
            structure["."].push(parts[0]);
        } else {
            // Pfad mit mehreren Teilen
            // Erstes Element ist ein top-level Verzeichnis?
            // insertFileIntoStructure kümmert sich um die Logik
            insertFileIntoStructure(structure, parts);
        }
    }

    // Files-Inhalt
    const filesContent: { [key: string]: string } = {};
    for (const file of selected) {
        const relPath = path.relative(workspaceFolder, file.uri.fsPath).replace(
            /\\/g,
            "/",
        );
        const fileContentBuffer = await vscode.workspace.fs.readFile(file.uri);
        filesContent[relPath] = fileContentBuffer.toString();
    }

    // Errors
    const errors: { file: string; line: number; errorMessage: string }[] = [];
    const allDiagnostics = vscode.languages.getDiagnostics();
    for (const [diagUri, diagList] of allDiagnostics) {
        if (!diagList || diagList.length === 0) continue;

        const relPath = path.relative(workspaceFolder, diagUri.fsPath).replace(
            /\\/g,
            "/",
        );

        for (const diag of diagList) {
            errors.push({
                file: relPath,
                line: diag.range.start.line,
                errorMessage: diag.message,
            });
        }
    }

    const data = {
        "project-context":
            "<User written description of his project, targets and the technology he is using>",
        "prompt": "<User written specific task the AI should be working on>",
        "structure": structure,
        "files": filesContent,
        "errors": errors,
    };

    const jsonStr = JSON.stringify(data, null, 2);

    const aiPromptUri = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders[0].uri,
        "aiPrompt.json",
    );
    await vscode.workspace.fs.writeFile(
        aiPromptUri,
        Buffer.from(jsonStr, "utf-8"),
    );

    // .gitignore aktualisieren
    const gitignoreUri = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders[0].uri,
        ".gitignore",
    );
    try {
        const gitignoreContent =
            (await vscode.workspace.fs.readFile(gitignoreUri)).toString();
        if (!gitignoreContent.includes("aiPrompt.json")) {
            const newContent = gitignoreContent.trim() + "\naiPrompt.json\n";
            await vscode.workspace.fs.writeFile(
                gitignoreUri,
                Buffer.from(newContent, "utf-8"),
            );
        }
    } catch (err) {
        const newContent = "aiPrompt.json\n";
        await vscode.workspace.fs.writeFile(
            gitignoreUri,
            Buffer.from(newContent, "utf-8"),
        );
    }

    const doc = await vscode.workspace.openTextDocument(aiPromptUri);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(
        "JSON file created and opened in a new tab.",
    );
}
