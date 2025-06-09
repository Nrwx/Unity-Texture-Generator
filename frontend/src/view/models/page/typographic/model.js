import {computed, reactive} from "vue";
import {textLayer} from "@/models/text/config/model";
import { normalizeFontName, injectFontFace } from "@/view/models/page/typographic/loader/model";
import {localData} from "@/dataLayer/local";

export function typographicModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const fontOptions = computed(() => {
        const rawFonts = localData.fonts.value || [];
        const options = [];

        for (const fontGroup of rawFonts) {
            const children = fontGroup.children || [];

            for (const font of children) {
                const fontName = normalizeFontName(font.name);
                const fontUrl = font.path;

                if (!localData.loadedFonts.value.has(fontName)) {
                    injectFontFace(fontName, fontUrl);
                    localData.loadedFonts.value.add(fontName);
                }

                options.push({
                    title: font.name,
                    value: `'${fontName}', sans-serif`,
                    id: font.id
                });
            }
        }

        console.log(options)

        return options;
    });

    const config = reactive({
        method: 10,
        fontSize: textLayer.value.fontSize,
        fontFamily: textLayer.value.fontFamily,
        fontWeight: textLayer.value.fontWeight,
        textAlign: textLayer.value.textAlign,
        lineHeight: textLayer.value.lineHeight,
        letterSpacing: textLayer.value.letterSpacing,
        textTransform: textLayer.value.textTransform,
        textDecoration: textLayer.value.textDecoration,
        color: textLayer.value.color,
    })

    const operation = {
        10: {
            fontSize: {
                type: 'number',
                label: 'Schriftgröße (px)',
                step: 1,
                min: 1,
                max: 200,
                event: 'apply-font-size',
                active: true
            },
            fontFamily: {
                type: 'select',
                label: 'Schriftart',
                options: fontOptions.value,
                event: 'apply-font-family',
                active: true,
                return: true
            },
            fontWeight: {
                type: 'select',
                label: 'Schriftstärke',
                options: [
                    { title: 'Normal', value: 'normal' },
                    { title: 'Bold', value: 'bold' },
                    { title: 'Light', value: 'lighter' },
                    { title: 'Bolder', value: 'bolder' }
                ],
                event: 'apply-font-weight',
                active: true
            },
            textAlign: {
                type: 'select',
                label: 'Ausrichtung',
                options: [
                    { title: 'Links', value: 'left' },
                    { title: 'Zentriert', value: 'center' },
                    { title: 'Rechts', value: 'right' },
                    { title: 'Blocksatz', value: 'justify' }
                ],
                event: 'apply-font-text-align',
                active: true
            },
            lineHeight: {
                type: 'slider',
                label: 'Zeilenhöhe',
                min: 1,
                max: 3,
                step: 0.1,
                event: 'apply-font-line-height',
                active: true
            },
            letterSpacing: {
                type: 'slider',
                label: 'Buchstabenabstand',
                min: -2,
                max: 5,
                step: 0.1,
                event: 'apply-font-letter-spacing',
                active: true
            },
            textTransform: {
                type: 'select',
                label: 'Text-Transformation',
                options: [
                    { title: 'Keine', value: 'none' },
                    { title: 'Großbuchstaben', value: 'uppercase' },
                    { title: 'Kleinbuchstaben', value: 'lowercase' },
                    { title: 'Erstes Wort Groß', value: 'capitalize' }
                ],
                event: 'apply-font-text-transform',
                active: true
            },
            textDecoration: {
                type: 'select',
                label: 'Text-Dekoration',
                options: [
                    { title: 'Keine', value: 'none' },
                    { title: 'Unterstrichen', value: 'underline' },
                    { title: 'Durchgestrichen', value: 'line-through' },
                    { title: 'Überstrichen', value: 'overline' }
                ],
                event: 'apply-font-text-decoration',
                active: true
            },
            color: {
                type: 'color',
                label: 'Textfarbe',
                event: 'apply-font-color',
                active: true
            }
        }
    }

    const computedStyle = computed(() => {
        return {
            fontFamily: config.fontFamily,
            fontWeight: config.fontWeight,
            textAlign: config.textAlign,
            lineHeight: config.lineHeight,
            letterSpacing:config.letterSpacing + 'px',
            textTransform: config.textTransform,
            textDecoration: config.textDecoration,
            color: config.color
        }
    })

    return {
        config,
        computedStyle,
        operation,
        emitEvent,
    };
}

export const typographicProps = {
};