import * as vscode from 'vscode';
import * as path from 'path';

interface FileItem {
    uri: vscode.Uri;
    selected: boolean;
}

export class FileNode extends vscode.TreeItem {
    constructor(
        public readonly file: FileItem
    ) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let label = path.basename(file.uri.fsPath);

        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const relativePath = path.relative(workspaceRoot, file.uri.fsPath);
            const parts = relativePath.split(path.sep);
            const fileName = parts.pop() || '';

            if (parts.length === 0) {
                // Datei direkt im Root
                label = fileName;
            } else if (parts.length === 1) {
                // Eine Ebene tiefer: Ordner/Datei
                label = `${parts[0]}/${fileName}`;
            } else {
                // Mindestens zwei Ebenen tiefer
                const lastTwoDirs = parts.slice(-2).join('/');
                label = `${lastTwoDirs}/${fileName}`;
            }
        }

        super(label);
        this.contextValue = file.selected ? 'fileItemSelected' : 'fileItemUnselected';

        // Use a standard codicon for selected/unselected states
        // Selected: 'check', Unselected: 'circle'
        this.iconPath = new vscode.ThemeIcon(file.selected ? 'check' : 'circle');
    }
}

export class FileDataProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined | void> = new vscode.EventEmitter<FileNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | void> = this._onDidChangeTreeData.event;

    private files: FileItem[] = [];
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.refreshFiles();
    }

    refreshFiles() {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            vscode.workspace.findFiles('**/*', '**/node_modules/**').then(uris => {
                const savedSelections = this.context.workspaceState.get<string[]>('selectedFiles', []);
                this.files = uris.map(uri => {
                    const isSelected = savedSelections.includes(uri.toString());
                    return { uri, selected: isSelected };
                });
                this._onDidChangeTreeData.fire();
            });
        }
    }

    getTreeItem(element: FileNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileNode): Thenable<FileNode[]> {
        if (!element) {
            return Promise.resolve(this.files.map(f => new FileNode(f)));
        } else {
            return Promise.resolve([]);
        }
    }

    toggleSelection(fileUri: vscode.Uri) {
        const file = this.files.find(f => f.uri.toString() === fileUri.toString());
        if (file) {
            file.selected = !file.selected;
            this.saveSelectionState();
            this._onDidChangeTreeData.fire();
        }
    }

    getSelectedFiles(): FileItem[] {
        return this.files.filter(f => f.selected);
    }

    getAllFiles(): FileItem[] {
        return this.files;
    }

    saveSelectionState() {
        const selectedUris = this.files.filter(f => f.selected).map(f => f.uri.toString());
        this.context.workspaceState.update('selectedFiles', selectedUris);
    }
}
