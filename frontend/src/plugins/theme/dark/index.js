import {shared} from "@/plugins/theme/shared";

export const darkTheme = {
    dark: true,
    icons: shared.icons,
    colors: {
        ...shared.colors,
        'background': '#20222a',
        'surface': '#1d1f25',
        'surface-bright': '#ff51ff',
        'surface-light': '#faa3fa',
        'surface-variant': '#292c32',
        'on-surface-variant': '#6cf',
        'primary': '#3f77d7',
        'primary-darken-1': '#195fd1',
        'secondary': '#0353a1',
        'secondary-darken-1': '#154e87',
        'border-light': '#3b3d42',
        'id-color' : '#ffb772',
        'error': '#b71c1c',
        'scroll-highlight-00' : '#3C4EFFF2',
        'scroll-highlight-01' : '#7C5CFFF2',
        'scroll-highlight-02' : '#5A78FFF2'
    },
    variables: {
        ...shared.variables,
        'overlay-opacity': 0.62
    }
}