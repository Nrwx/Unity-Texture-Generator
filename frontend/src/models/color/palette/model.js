import {ref} from "vue";

export function colorPaletteModel(props, emit) {

    const menu = ref(false);
    const tone = ref('dark');

    const materialColorShades = {
        red: {
            light: ["#FFCDD2", "#EF9A9A", "#E57373", "#EF5350", "#F44336", "#D32F2F", "#B71C1C"],
            dark:  ["#B71C1C", "#C62828", "#D32F2F", "#E53935", "#EF5350", "#E57373", "#FFCDD2"],
        },
        pink: {
            light: ["#F8BBD0", "#F48FB1", "#F06292", "#EC407A", "#E91E63", "#C2185B", "#880E4F"],
            dark:  ["#880E4F", "#AD1457", "#C2185B", "#D81B60", "#E91E63", "#F06292", "#F8BBD0"],
        },
        purple: {
            light: ["#E1BEE7", "#CE93D8", "#BA68C8", "#AB47BC", "#9C27B0", "#7B1FA2", "#4A148C"],
            dark:  ["#4A148C", "#6A1B9A", "#7B1FA2", "#8E24AA", "#9C27B0", "#BA68C8", "#E1BEE7"],
        },
        indigo: {
            light: ["#C5CAE9", "#9FA8DA", "#7986CB", "#5C6BC0", "#3F51B5", "#303F9F", "#1A237E"],
            dark:  ["#1A237E", "#283593", "#303F9F", "#3949AB", "#3F51B5", "#7986CB", "#C5CAE9"],
        },
        blue: {
            light: ["#BBDEFB", "#90CAF9", "#64B5F6", "#42A5F5", "#2196F3", "#1976D2", "#0D47A1"],
            dark:  ["#0D47A1", "#1565C0", "#1976D2", "#1E88E5", "#2196F3", "#64B5F6", "#BBDEFB"],
        },
        cyan: {
            light: ["#B2EBF2", "#80DEEA", "#4DD0E1", "#26C6DA", "#00BCD4", "#0097A7", "#006064"],
            dark:  ["#006064", "#00838F", "#0097A7", "#00ACC1", "#00BCD4", "#4DD0E1", "#B2EBF2"],
        },
        teal: {
            light: ["#B2DFDB", "#80CBC4", "#4DB6AC", "#26A69A", "#009688", "#00796B", "#004D40"],
            dark:  ["#004D40", "#00695C", "#00796B", "#00897B", "#009688", "#4DB6AC", "#B2DFDB"],
        },
        green: {
            light: ["#C8E6C9", "#A5D6A7", "#81C784", "#66BB6A", "#4CAF50", "#388E3C", "#1B5E20"],
            dark:  ["#1B5E20", "#2E7D32", "#388E3C", "#43A047", "#4CAF50", "#81C784", "#C8E6C9"],
        },
        lime: {
            light: ["#F0F4C3", "#E6EE9C", "#DCE775", "#D4E157", "#CDDC39", "#AFB42B", "#827717"],
            dark:  ["#827717", "#9E9D24", "#AFB42B", "#C0CA33", "#CDDC39", "#DCE775", "#F0F4C3"],
        },
        yellow: {
            light: ["#FFF9C4", "#FFF59D", "#FFF176", "#FFEE58", "#FFEB3B", "#FBC02D", "#F57F17"],
            dark:  ["#F57F17", "#F9A825", "#FBC02D", "#FDD835", "#FFEB3B", "#FFF176", "#FFF9C4"],
        },
        amber: {
            light: ["#FFECB3", "#FFE082", "#FFD54F", "#FFCA28", "#FFC107", "#FFA000", "#FF6F00"],
            dark:  ["#FF6F00", "#FF8F00", "#FFA000", "#FFB300", "#FFC107", "#FFD54F", "#FFECB3"],
        },
        orange: {
            light: ["#FFE0B2", "#FFCC80", "#FFB74D", "#FFA726", "#FF9800", "#FB8C00", "#EF6C00"],
            dark:  ["#EF6C00", "#F57C00", "#FB8C00", "#FF9800", "#FFA726", "#FFB74D", "#FFE0B2"],
        },
        deepOrange: {
            light: ["#FFCCBC", "#FFAB91", "#FF8A65", "#FF7043", "#FF5722", "#E64A19", "#BF360C"],
            dark:  ["#BF360C", "#D84315", "#E64A19", "#F4511E", "#FF5722", "#FF8A65", "#FFCCBC"],
        },
        brown: {
            light: ["#D7CCC8", "#BCAAA4", "#A1887F", "#8D6E63", "#795548", "#5D4037", "#3E2723"],
            dark:  ["#3E2723", "#4E342E", "#5D4037", "#6D4C41", "#795548", "#A1887F", "#D7CCC8"],
        },
        blueGrey: {
            light: ["#CFD8DC", "#B0BEC5", "#90A4AE", "#78909C", "#607D8B", "#455A64", "#263238"],
            dark:  ["#263238", "#37474F", "#455A64", "#546E7A", "#607D8B", "#90A4AE", "#CFD8DC"],
        }
    };

    const selectColor = (color) => {
        emit('update:modelValue', color);
        emit('close');
        menu.value = false;
    };

    const handleMenuToggle = (val) => {
        emit(val ? "open" : "close");
    };

    return {
        menu,
        tone,
        materialColorShades,
        handleMenuToggle,
        selectColor,
    };
}

export const colorPaletteProps = {
    modelValue: String,
    label: String
};