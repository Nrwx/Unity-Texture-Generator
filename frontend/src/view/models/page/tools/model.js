export function toolsModel(emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    // Example tool data
    const toolData = [
        { label: "Ausschneiden", category: "Bild", event: "tools-state", val: 1, color: "blue", icon: "mdi-content-cut" },
        { label: "Resize Image", category: "Bearbeitung", action: "resizeImage", color: "green", icon: "mdi-crop" },
        { label: "Rotate Image", category: "Bearbeitung", action: "rotateImage", color: "teal", icon: "mdi-rotate-3d" },
        { label: "Apply Filter", category: "Filter", action: "applyFilter", color: "purple", icon: "mdi-filter-variant" },
        { label: "Calculate Area", category: "Berechnung", action: "calculateArea", color: "orange", icon: "mdi-calculator" },
        { label: "Flip Image", category: "Bearbeitung", action: "flipImage", color: "pink", icon: "mdi-flip-horizontal" },
        { label: "Adjust Brightness", category: "Bearbeitung", action: "adjustBrightness", color: "amber", icon: "mdi-brightness-6" },
    ];

    // Group tools by category
    const categorizedTools = [
        { name: "Bild", description: "Tools zur Bildverwaltung", tools: toolData.filter(t => t.category === "Bild") },
        { name: "Bearbeitung", description: "Bildbearbeitungswerkzeuge", tools: toolData.filter(t => t.category === "Bearbeitung") },
        { name: "Berechnung", description: "Berechnungswerkzeuge", tools: toolData.filter(t => t.category === "Berechnung") },
        { name: "Filter", description: "Filter-Werkzeuge", tools: toolData.filter(t => t.category === "Filter") },
    ];

    return {
        toolData,
        categorizedTools,
        emitEvent,
    };
}

export const toolsProps = {
};