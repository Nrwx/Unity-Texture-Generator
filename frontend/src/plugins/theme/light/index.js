import {shared} from "@/plugins/theme/shared";

export const lightTheme = {
    dark: false,
    icons: shared.icons,
    colors: {
        ...shared.colors,
        'background': '#FFFFFF',
        'surface': '#FFFFFF',
        'surface-bright': '#FFFFFF',
        'surface-light': '#EEEEEE',
        'surface-variant': '#424242',
        'on-surface-variant': '#EEEEEE',
        'primary': '#1867C0',
        'primary-darken-1': '#1F5592',
        'secondary': '#48A9A6',
        'secondary-darken-1': '#018786'
    },
    variables: {
        ...shared.variables,
        'border-color': '#000000',
        'border-opacity': 0.12,
        'theme-kbd': '#212529',
        'theme-on-kbd': '#FFFFFF',
        'theme-code': '#F5F5F5',
        'theme-on-code': '#000000',
    }
}