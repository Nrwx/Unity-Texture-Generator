export function fileModel(props, emit) {
    const emitFile = (event) => {
        const uploadedFile = event.target.files[0];
        emit("component-event", "apply-file", uploadedFile);
    };
    const uploadFile = () => {
        emit("component-event", "upload-file");
    };
    return {
        emitFile,
        uploadFile,
    };
}

export const fileProps = {
    file: {},
};