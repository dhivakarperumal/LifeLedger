import * as FileSystem from "expo-file-system/legacy";

export const GOOGLE_DRIVE_FOLDER_NAME = (email: string) => `LifeLedger_Vault_${email.replace(/[@.]/g, '_')}`;

export const getOrCreateFolder = async (accessToken: string, folderName: string) => {
    try {
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
        const searchData = await searchRes.json();

        if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
        }

        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: folderName,
                mimeType: "application/vnd.google-apps.folder",
            }),
        });
        const folder = await createRes.json();
        return folder.id;
    } catch (e) {
        console.error("Folder creation error", e);
        return null;
    }
};

export const uploadMediaToDrive = async (accessToken: string, folderId: string, uri: string, fileName: string, mimeType: string) => {
    try {
        // 1. Initialize file metadata
        const metadataRes = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: fileName,
                mimeType: mimeType,
                parents: [folderId]
            }),
        });

        if (!metadataRes.ok) throw new Error("Metadata failed");
        const metadata = await metadataRes.json();
        const fileId = metadata.id;

        let uploadUri = uri;
        let isTempFile = false;

        // If base64, write to temp file first
        if (uri.startsWith("data:")) {
            const base64Data = uri.split(",")[1];
            uploadUri = FileSystem.cacheDirectory + "upload_temp_" + Date.now();
            await FileSystem.writeAsStringAsync(uploadUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
            isTempFile = true;
        }

        // 2. Upload content
        const uploadRes = await FileSystem.uploadAsync(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            uploadUri,
            {
                httpMethod: "PATCH",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": mimeType,
                },
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            }
        );

        if (isTempFile) {
            await FileSystem.deleteAsync(uploadUri, { idempotent: true });
        }

        if (uploadRes.status === 200 || uploadRes.status === 201) {
            return fileId;
        }
        return null;
    } catch (e) {
        console.error("Upload media error", e);
        return null;
    }
};
