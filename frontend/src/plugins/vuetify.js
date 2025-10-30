import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import {lightTheme} from "@/plugins/theme/light";
import {darkTheme} from "@/plugins/theme/dark";
export default createVuetify({
    theme: {
        defaultTheme: 'lightTheme',
        themes: {
            lightTheme,
            darkTheme
        }
    },
})
