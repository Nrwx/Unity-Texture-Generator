<template>
  <div class="viewport-wrapper" @mousedown="resetSelection">
    <!-- Hauptcontainer: Zentriert das Canvas -->
    <div class="main-layer">
      <!-- Lineale -->
      <div class="ruler x-axis d-flex" @mousedown="startGuide('horizontal', $event)" :style="{ width: `calc(100% + ${settings.width * zoomFaktor}px)`}">
        <div class="d-flex align-center ma-auto" style="height: 100%;" :style="{ width: `${settings.width * zoomFaktor}px`, transform: `translateX(${offset.x}px)` }">
          <div
              v-for="x in columnPositions"
              :key="x"
              class="ruler-mark"
              :style="{ width: `${50 * zoomFaktor}px`}"
          >
            {{ Math.round(x) }}
          </div>
        </div>
      </div>

      <div class="ruler y-axis d-flex" @mousedown="startGuide('vertical', $event)" :style="{ height: `calc(100% + ${settings.height * zoomFaktor}px)`}">
        <div class="d-flex flex-column align-center ma-auto" style="width: 100%;" :style="{ height: `${settings.height * zoomFaktor}px`, transform: `translateY(${offset.y}px)` }">
          <div
              v-for="y in rowPositions"
              :key="y"
              class="ruler-mark"
              :style="{ height: `${50 * zoomFaktor}px`}"
          >
            {{ Math.round(y) }}
          </div>
        </div>
      </div>

      <div v-for="guide in guides" :key="guide.id" class="guide"
           :style="getGuideStyle(guide)" @mousedown="startDraggingGuide(guide, $event)">
      </div>

      <!-- Canvas Container -->
      <div class="canvas-row" style="position: relative;">
        <div
            ref="canvasContainer"
            class="canvas-container d-flex align-center justify-center overflow-hidden"
            :style="canvasContainerStyle"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
        >
          <!-- Zentrale Inhalte im Canvas -->
          <div class="canvas-content">
            <Image
                :layers="layers"
                :selected-layer="selectedLayer"
                @update:select-layer="toggleSelection"
            >
            </Image>
            <template v-if="selectedLayer.length">
              <svg
                  :width="frameBox.width"
                  :height="frameBox.height"
                  :style="{ position: 'absolute', top: frameBox.top + 'px', left: frameBox.left + 'px', pointerEvents: 'none', zIndex: 9999 }"
              >
                <rect
                    x="0"
                    y="0"
                    :width="frameBox.width"
                    :height="frameBox.height"
                    fill="none"
                    stroke="#00aaff"
                    stroke-width="4"
                    stroke-dasharray="4"
                />

                <!-- Griffe analog -->
                <circle class="resize-handle" cx="0" cy="0" r="8" @mousedown="startResize('top-left', $event)" />
                <circle class="resize-handle" :cx="frameBox.width" cy="0" r="8" @mousedown="startResize('top-right', $event)" />
                <circle class="resize-handle" cx="0" :cy="frameBox.height" r="8" @mousedown="startResize('bottom-left', $event)" />
                <circle class="resize-handle" :cx="frameBox.width" :cy="frameBox.height" r="8" @mousedown="startResize('bottom-right', $event)" />

                <circle class="rotate-handle" :cx="frameBox.width / 2" cy="0" r="6" @mousedown="startRotate('top', $event)" />
                <circle class="rotate-handle" :cx="frameBox.width / 2" :cy="frameBox.height" r="6" @mousedown="startRotate('bottom', $event)" />
                <circle class="rotate-handle" cx="0" :cy="frameBox.height / 2" r="6" @mousedown="startRotate('left', $event)" />
                <circle class="rotate-handle" :cx="frameBox.width" :cy="frameBox.height / 2" r="6" @mousedown="startRotate('right', $event)" />

                <circle class="center-crosshair" :cx="frameBox.width / 2" :cy="frameBox.height / 2" r="6" fill="#00aaff" />
              </svg>
            </template>
            <div v-if="!selectedLayer.length" class="center-crosshair"></div>

            <Text :state="text" @update:component-event="emitEvent" :layer="textLayer"/>
          </div>
        </div>
      </div>

      <!-- Koordinatenanzeige -->
      <div class="cursor-coordinates">
        {{ `X: ${cursor.x}, Y: ${cursor.y}` }}
      </div>

      <!-- Selection Box -->
      <Selection
          :state="select"
          :shape="selectMode"
          @update:component-event="emitEvent"
      />
    </div>
  </div>
</template>

<script>
import {computed, defineComponent, onMounted, onUnmounted, ref} from "vue";
import Image from "@/components/Image/Image";
import {transformStates, canvasStates} from "@/dataLayer/state";
import Selection from "@/components/Selection/Selection.vue";
import Text from "@/components/Text/Text.vue";

export default defineComponent({
  name: "GridComponent",
  props: {
    settings: {
      type: Object,
      required: true,
    },
    layers: {
      type: Array,
      required: true,
    },
    select: {
      type: Boolean,
      required: true,
    },
    text: {
      type: Boolean,
      required: true,
    },
    textLayer: {
      type: Object,
      required: true,
    },
    selectMode: {
      type: String,
      required: true,
    },
  },
  components: {
    Text,
    Image,
    Selection
  },
  setup(props, { emit }) {
    const canvasContainer = ref(null);
    const selectedLayer = ref([]);

    const zoomFaktor = ref(1);
    const offset = ref({x: 0, y: 0})
    const cursor = ref({ x: 0, y: 0 });
    const lastMouse = ref({x: 0, y: 0})
    const guides = ref([]);
    const guide = ref({});
    const resizeDirection = ref('');
    const rotationStartAngle = ref(0);
    const fineSnapAngle = 360 / 64; // Das ergibt 5.625° pro Schritt
    const alignModeStep = ref(0);

    const emitEvent = (event, payload) => {
      emit("component-event", event, payload);
      console.log(event, payload, 'GRID:VUE')
    };

    const cycleAlignMode = () => {
      if (transformStates.align.value) {
        alignModeStep.value = (alignModeStep.value + 1) % 3; // 0 → 1 → 2 → 0 ...
      } else {
        alignModeStep.value = 0; // Zurücksetzen wenn align nicht aktiv
      }
    };

    const handleMouseMove = (event) => {
      event.preventDefault();
      // Berechne die tatsächliche Mausposition relativ zum Canvas Container
      const rect = canvasContainer.value.getBoundingClientRect();
      const scaledX = (event.clientX - rect.left);
      const scaledY = (event.clientY - rect.top);

      cursor.value.x = Math.round(scaledX);
      cursor.value.y = Math.round(scaledY);

      const dx = (event.clientX - lastMouse.value.x);
      const dy = (event.clientY - lastMouse.value.y);

      // Transformieren:
      if (transformStates.transform.value) {
        selectedLayer.value.forEach(layer => {
          if (transformStates.align.value) {
            // Handle Align Modes
            if (alignModeStep.value === 1) {
              layer.matrix.x += dx;
            } else if (alignModeStep.value === 2) {
              layer.matrix.y += dy;
            } else {
              layer.matrix.x += dx;
              layer.matrix.y += dy;
            }
          } else {
            // Normales Transformieren
            layer.matrix.x += dx;
            layer.matrix.y += dy;
          }
        });
      } else if (canvasStates.transform.value) {
        offset.value.x += dx;
        offset.value.y += dy;
      }
      // Resizing (Skalierung)
      else if (transformStates.size.value) {
        handleResize(dx, dy);
      }
      // Rotation
      else if (transformStates.rotate.value) {
        handleRotate(event);
      }

      lastMouse.value.x = event.clientX;
      lastMouse.value.y = event.clientY;
    };

    // Start Resize
    const startResize = (corner, event) => {
      transformStates.menu.value = true
      transformStates.size.value = true;
      resizeDirection.value = corner;
      lastMouse.value.x = event.clientX;
      lastMouse.value.y = event.clientY;
      document.addEventListener("mouseup", stopTransform);
    };

// Start Rotate
    const startRotate = (direction, event) => {
      transformStates.menu.value = true
      transformStates.rotate.value = true;
      rotationStartAngle.value = calculateRotation(event.clientX, event.clientY);
      lastMouse.value.x = event.clientX;
      lastMouse.value.y = event.clientY;
      document.addEventListener("mouseup", stopTransform);
    };

// Berechnung der Rotation im Grad
    const calculateRotation = (mouseX, mouseY) => {
      if (!selectedLayer.value.length) return 0;

      const crosshair = document.querySelector(".center-crosshair");
      const crosshairRect = crosshair.getBoundingClientRect();
      const centerX = crosshairRect.left + crosshairRect.width / 2;
      const centerY = crosshairRect.top + crosshairRect.height / 2;

      const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
      return angle * (180 / Math.PI); // Umwandlung von Radiant zu Grad
    };

    const getSnappedAngle = (angle) => {

      // Berechne den Restwert nach Division des Winkels durch den feinen Snap-Winkel
      const remainder = angle % fineSnapAngle;

      // Wenn der Restwert näher an 0 ist, runden wir ab, andernfalls runden wir auf
      if (remainder < fineSnapAngle / 2) {
        return angle - remainder;  // Abrunden
      } else {
        return angle + (fineSnapAngle - remainder);  // Aufrunden
      }
    };

// Handle der Rotation
    const handleRotate = (event) => {
      event.preventDefault();

      const crosshair = document.querySelector(".center-crosshair");
      const crosshairRect = crosshair.getBoundingClientRect();
      const centerX = crosshairRect.left + crosshairRect.width / 2;
      const centerY = crosshairRect.top + crosshairRect.height / 2;

      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Vermeide Division durch 0 oder zu kleine Werte (näher am Zentrum)
      const dampingFactor = Math.min(1, distance / 100); // Skaliert auf max 1, z.B. bei 100px Abstand

      const currentAngle = calculateRotation(event.clientX, event.clientY);
      let deltaAngle = currentAngle - rotationStartAngle.value;

      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;

      deltaAngle *= dampingFactor; // Hier erfolgt die Dämpfung

      selectedLayer.value.forEach(layer => {
        let newRotation = (layer.matrix.rotate + deltaAngle + 360) % 360;

        if (transformStates.align.value) {
          newRotation = getSnappedAngle(newRotation);
        }

        layer.matrix.rotate = parseFloat(newRotation.toFixed(2));
      });

      rotationStartAngle.value = currentAngle;
    };

    // Handle Resize
    const handleResize = (dx, dy) => {
      selectedLayer.value.forEach(layer => {
        const originalWidth = layer.width;
        const originalHeight = layer.height;

        if (transformStates.align.value) {
          // Wenn Shift gedrückt ist, gleichmäßige Skalierung (synchron auf X und Y)
          const scale = Math.max(dx / originalWidth, dy / originalHeight);
          layer.matrix.a += scale;
          layer.matrix.d += scale;
        } else {
          // Skalierung entlang der X-Achse
          if (resizeDirection.value.includes('left') || resizeDirection.value.includes('right')) {
            const scaleX = dx / originalWidth;
            layer.matrix.a += scaleX;
            // Verhindere extreme Skalierung
            layer.matrix.a = Math.max(0.1, Math.min(layer.matrix.a, 5)); // Beispiel: Skalierung von 10% bis 500%
          }

          // Skalierung entlang der Y-Achse
          if (resizeDirection.value.includes('top') || resizeDirection.value.includes('bottom')) {
            const scaleY = dy / originalHeight;
            layer.matrix.d += scaleY;
            // Verhindere extreme Skalierung
            layer.matrix.d = Math.max(0.1, Math.min(layer.matrix.d, 5)); // Beispiel: Skalierung von 10% bis 500%
          }
        }

        // Position anpassen
        if (resizeDirection.value.includes('top')) {
          layer.matrix.y += dy;  // Verschiebung nach oben
        } else if (resizeDirection.value.includes('bottom')) {
          // Keine direkte Änderung der Y-Position bei unten
        }

        if (resizeDirection.value.includes('left')) {
          layer.matrix.x += dx;  // Verschiebung nach links
        } else if (resizeDirection.value.includes('right')) {
          // Keine direkte Änderung der X-Position bei rechts
        }
      });
    }


    const resetSelection = (event) => {
      event.preventDefault();
      if (!canvasContainer.value.contains(event.target) && !event.ctrlKey
          || !transformStates.menu.value && !transformStates.transform.value && !event.ctrlKey
          || !transformStates.menu.value && !transformStates.rotate.value && !event.ctrlKey
          || !transformStates.menu.value && !transformStates.size.value && !event.ctrlKey) {
        selectedLayer.value.forEach(layer => {
          updateLayer(layer)
        })
        transformStates.align.value = false
        alignModeStep.value = 0
        selectedLayer.value = []
        stopTransform()
      }
    };

    const hasMatrixChanged = (a, b) => {
      if (!a || !b) return true;

      for (const key in a) {
        if (a[key] !== b[key]) {
          return true;
        }
      }

      return false;
    };

    const storeOriginalMatrix = (layer) => {
      if (!layer.__originalMatrix) {
        layer.__originalMatrix = { ...layer.matrix }; // flache Kopie reicht
      }
    };

    const updateLayer = (layer) => {
      if (hasMatrixChanged(layer.__originalMatrix, layer.matrix)) {
        emitEvent('update-layer', layer);
        console.log('Layer aktualisiert');
      } else {
        console.log('Layer unverändert');
      }
    };

    const toggleSelection = (layer, event) => {
      event.preventDefault();
      transformStates.transform.value = false
      transformStates.size.value = false
      transformStates.rotate.value = false
      const index = selectedLayer.value.findIndex(l => l.id === layer.id);
      storeOriginalMatrix(layer);

      if (event.ctrlKey) {
        if (index === -1) {
          storeOriginalMatrix(layer);
          selectedLayer.value.push(layer);
        } else {
          selectedLayer.value.splice(index, 1);
        }
      } else {
        storeOriginalMatrix(layer);
        selectedLayer.value = [layer];
      }
    };


    const columnPositions = computed(() => {
      const positions = [];
      const step = 50;
      for (let x = 0; x <= props.settings.width; x += step) {
        positions.push(x);
      }
      return positions;
    });

    const rowPositions = computed(() => {
      const positions = [];
      const step = 50;
      for (let y = 0; y <= props.settings.height; y += step) {
        positions.push(y);
      }
      return positions;
    });

    const canvasContainerStyle = computed(() => ({
      width: `${props.settings.width}px`,
      height: `${props.settings.height}px`,
      transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${zoomFaktor.value})`,
      transformOrigin: "center center",
    }));

    const handleMouseDown = (event) => {
      event.preventDefault();
      const clickedInsideCanvas = event.target.closest('.canvas-container');

      if (!clickedInsideCanvas) {
        emitEvent('reset-selected-layer')
        return;
      }

      if (canvasStates.select.value) {
        return;
      }
      if (canvasStates.zoom.value) {
        if (event.button === 0) {
          zoomFaktor.value = Math.min(zoomFaktor.value + 0.1, 2);
        } else if (event.button === 2) {
          event.preventDefault();
          zoomFaktor.value = Math.max(zoomFaktor.value - 0.1, 0.5);
        }
      }
    };


    // Stop Transform (Resizing or Rotating)
    const stopTransform = () => {
      transformStates.menu.value = false
      transformStates.transform.value = false
      transformStates.size.value = false;
      transformStates.rotate.value = false;
      document.removeEventListener("mouseup", stopTransform);
    };


    const startPan = (event) => {
      event.preventDefault();
      if (!canvasStates.transform.value) return;
      lastMouse.value.x = event.clientX;
      lastMouse.value.y = event.clientY;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stopPan);
    };

    const stopPan = () => {
      canvasStates.transform.value = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopPan);
    };

    const startDraggingGuide = (helper, event) => {
      event.preventDefault();
      guide.value = helper;
      document.addEventListener("mousemove", dragGuide);
      document.addEventListener("mouseup", stopDraggingGuide);
    };

    const startGuide = (type, event) => {
      event.preventDefault();
      // Berechne die Position relativ zur aktuellen Verschiebung (Offset)
      const position = type === 'horizontal'
          ? event.clientY - offset.value.y
          : event.clientX - offset.value.x;

      // Prüfen, ob eine bestehende Hilfslinie an dieser Position existiert
      const index = guides.value.findIndex(g => g.type === type && Math.abs(g.position - position) < 5);

      if (index !== -1) {
        // Entferne die bestehende Hilfslinie
        guides.value.splice(index, 1);
      } else {
        // Neue Hilfslinie erstellen
        const guide = { id: Date.now(), type, position };
        guides.value.push(guide);
        startDraggingGuide(guide, event);
      }
    };

    const dragGuide = (event) => {
      event.preventDefault();
      if (!guide.value) return;

      const newPosition = guide.value.type === 'horizontal'
          ? event.clientY - offset.value.y
          : event.clientX - offset.value.x;

      if (guide.value.position !== newPosition) {
        guide.value.position = newPosition;
      }
    };

    const stopDraggingGuide = () => {
      if (!guide.value) return;

      // Prüfen, ob die Hilfslinie auf das Lineal zurückgelegt wurde
      const isOnXAxis = guide.value.type === 'horizontal' && guide.value.position <= 20;
      const isOnYAxis = guide.value.type === 'vertical' && guide.value.position <= 20;

      if (isOnXAxis || isOnYAxis) {
        // Lösche die Hilfslinie
        guides.value = guides.value.filter(g => g.id !== guide.value.id);
      }

      guide.value = null;
      document.removeEventListener("mousemove", dragGuide);
      document.removeEventListener("mouseup", stopDraggingGuide);
    };

    const getGuideStyle = (guide) => {
      return guide.type === 'horizontal'
          ? {
            top: `${guide.position + offset.value.y}px`,
            left: '0',
            right: '0',
            width: '100%',
            height: '1px',
            background: 'blue',
            position: 'absolute',
            cursor: 'row-resize'
          }
          : {
            left: `${guide.position + offset.value.x}px`,
            top: '0',
            bottom: '0',
            height: '100%',
            width: '1px',
            background: 'blue',
            position: 'absolute',
            cursor: 'col-resize'
          };
    };

    const handleKeyDown = (event) => {
      // Wenn der Fokus in einem Input oder Textarea liegt → Eingabe zulassen
      const tag = event.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      event.preventDefault();
      if (event.key.toLowerCase() === "r") {
        //rotateSelectedLayers();
      }
      if (event.key === "w") {
        canvasStates.select.value = !canvasStates.select.value;
      }
      if (event.key === 'g') {
        if (selectedLayer.value.length) {
          transformStates.menu.value = true
          transformStates.transform.value = true;
        } else {
          canvasStates.transform.value = true;
        }
      }
      if (event.key === 'z') canvasStates.zoom.value = !canvasStates.zoom.value;

      if (event.key === "Shift") {
        transformStates.align.value = true;
      }
    };

    const handleKeyUp = (event) => {
      const tag = event.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      event.preventDefault();
      if (event.key === 'g') {
        canvasStates.transform.value = false;
        transformStates.transform.value = false;
        transformStates.menu.value = false
      }
      if (event.key === "Shift") {
        if (transformStates.transform.value) {
          cycleAlignMode()
        } else {
          transformStates.align.value = false;
        }
      }
    };

    const frameBox = computed(() => {
      const layers = selectedLayer.value;
      if (!layers.length) return { top: 0, left: 0, width: 0, height: 0 };

      const allPoints = layers.flatMap(layer => {
        const matrix = layer.matrix || {};
        const rotate = (matrix.rotate || 0) * (Math.PI / 180);
        const scaleX = matrix.a ?? 1;
        const scaleY = matrix.d ?? 1;
        const posX = matrix.x ?? 0;
        const posY = matrix.y ?? 0;

        const width = layer.width;
        const height = layer.height;

        const cx = width / 2;
        const cy = height / 2;

        const cos = Math.cos(rotate);
        const sin = Math.sin(rotate);

        const rotatePoint = (x, y) => {
          const dx = x - cx;
          const dy = y - cy;

          const rx = dx * cos - dy * sin + cx;
          const ry = dx * sin + dy * cos + cy;
          return { x: rx, y: ry };
        };

        // 1. Rotierte Punkte (wie PIL rotate(..., center=(cx, cy), expand=True))
        const rotatedCorners = [
          rotatePoint(0, 0),
          rotatePoint(width, 0),
          rotatePoint(0, height),
          rotatePoint(width, height)
        ];

        // 2. Skaliere die rotierte Box
        const scaledCorners = rotatedCorners.map(p => ({
          x: p.x * scaleX,
          y: p.y * scaleY
        }));

        // 3. Berechne das neue Zentrum nach Skalierung
        const centerScaledX = (width * scaleX) / 2;
        const centerScaledY = (height * scaleY) / 2;

        // 4. Offset berechnen wie im Backend
        const offsetX = centerScaledX - cx;
        const offsetY = centerScaledY - cy;

        // 5. Endposition: addiere matrix.x, matrix.y, abzüglich des Offsets
        return scaledCorners.map(p => ({
          x: p.x + posX - offsetX,
          y: p.y + posY - offsetY
        }));
      });

      const xs = allPoints.map(p => p.x);
      const ys = allPoints.map(p => p.y);

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return {
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    });




    onMounted(() => {
      document.addEventListener("mousedown", resetSelection);
      document.addEventListener("contextmenu", (event) => event.preventDefault());
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("keyup", handleKeyUp);
      document.addEventListener("mousedown", startPan);
    });

    onUnmounted(() => {
      document.removeEventListener("contextmenu", (event) => event.preventDefault());
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", resetSelection);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousedown", startPan);
      document.removeEventListener("mousemove", handleMouseMove);
    });

    return {
      selectedLayer,
      canvasContainer,
      offset,
      cursor,
      canvasContainerStyle,
      handleMouseDown,
      handleMouseMove,
      zoomFaktor,
      columnPositions,
      rowPositions,
      guides,
      startGuide,
      startDraggingGuide,
      getGuideStyle,
      emitEvent,
      toggleSelection,
      resetSelection,
      startRotate,
      startResize,
      updateLayer,
      frameBox
    };
  },
});
</script>

<style scoped lang="scss">
@import 'Grid.scss';
</style>