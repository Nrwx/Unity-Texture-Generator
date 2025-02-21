<template>
  <div class="viewport-wrapper" @mousedown="resetSelection">
    <!-- Hauptcontainer: Zentriert das Canvas -->
    <div class="main-layer">
      <!-- Lineale -->
      <div class="ruler x-axis d-flex" @mousedown="startGuide('horizontal', $event)">
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

      <div class="ruler y-axis d-flex" @mousedown="startGuide('vertical', $event)">
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
                @update:layer="updateLayer"
            >
              <!-- Transformations-Overlay -->
              <template #menu>
                <div v-if="selectedLayer.length" class="selection-overlay">
                  <!-- Resize Handles -->
                  <div class="resize-handle top-left" @mousedown="startResize('top-left', $event)"></div>
                  <div class="resize-handle top-right" @mousedown="startResize('top-right', $event)"></div>
                  <div class="resize-handle bottom-left" @mousedown="startResize('bottom-left', $event)"></div>
                  <div class="resize-handle bottom-right" @mousedown="startResize('bottom-right', $event)"></div>

                  <!-- Rotate Handles -->
                  <div class="rotate-handle top" @mousedown="startRotate('top', $event)"></div>
                  <div class="rotate-handle bottom" @mousedown="startRotate('bottom', $event)"></div>
                  <div class="rotate-handle left" @mousedown="startRotate('left', $event)"></div>
                  <div class="rotate-handle right" @mousedown="startRotate('right', $event)"></div>
                </div>
              </template>
            </Image>
            <div class="center-crosshair"></div>
          </div>
        </div>
      </div>

      <!-- Koordinatenanzeige -->
      <div class="cursor-coordinates">
        {{ `X: ${cursor.x}, Y: ${cursor.y}` }}
      </div>
    </div>
  </div>
</template>

<script>
import {computed, defineComponent, onMounted, onUnmounted, reactive, ref} from "vue";
import Image from "@/components/Image/Image";
import {transformStates, canvasStates} from "@/dataLayer/state";

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
  },
  components: {
    Image
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

    const transformState = reactive({
      size: false,
      rotate: false
    });

    const emitEvent = (event, payload) => {
      emit("component-event", event, payload);
    };

    // Start Resize
    const startResize = (corner, event) => {
      transformState.size = true;
      resizeDirection.value = corner;
      lastMouse.value.x = event.clientX;
      lastMouse.value.y = event.clientY;
      document.addEventListener("mouseup", stopTransform);
    };

    // Start Rotate
    const startRotate = (direction, event) => {
      transformState.rotate = true;
      rotationStartAngle.value = calculateRotation(event.clientX, event.clientY);
      lastMouse.value.x = event.clientX;
      lastMouse.value.y = event.clientY;
      document.addEventListener("mouseup", stopTransform);
    };

    // Berechnung der Rotation im Grad
    const calculateRotation = (mouseX, mouseY) => {
      if (!selectedLayer.value.length) return 0;

      // Gemeinsames Zentrum berechnen
      const totalX = selectedLayer.value.reduce((sum, layer) => sum + (layer.x + layer.width / 2), 0);
      const totalY = selectedLayer.value.reduce((sum, layer) => sum + (layer.y + layer.height / 2), 0);

      const centerX = totalX / selectedLayer.value.length;
      const centerY = totalY / selectedLayer.value.length;

      // Winkel berechnen
      const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
      return angle * (180 / Math.PI); // Umwandlung von Bogenmaß zu Grad
    };


    // Berechnung des Resize-Verhältnisses
    const handleResize = (dx, dy) => {
      selectedLayer.value.forEach(layer => {
        if (resizeDirection.value.includes('top')) {
          layer.height -= dy;
          layer.y += dy; // Verschiebung nach oben
        } else if (resizeDirection.value.includes('bottom')) {
          layer.height += dy;
        }

        if (resizeDirection.value.includes('left')) {
          layer.width -= dx;
          layer.x += dx; // Verschiebung nach links
        } else if (resizeDirection.value.includes('right')) {
          layer.width += dx;
        }
      });
    };

    // Berechnung der Rotation
    const handleRotate = (event) => {
      event.preventDefault();
      const currentAngle = calculateRotation(event.clientX, event.clientY);
      const deltaAngle = currentAngle - rotationStartAngle.value;

      selectedLayer.value.forEach(layer => {
        layer.rotate = parseFloat((layer.rotate + deltaAngle).toFixed(2));
      });
      rotationStartAngle.value = currentAngle; // Setze den Startwinkel zurück
    };

    const resetSelection = (event) => {
      if (!canvasContainer.value.contains(event.target) && selectedLayer.value.length) {
        selectedLayer.value = [];
        props.layers.forEach(layer => {
          updateLayer(layer)
        });
      }
    };

    const updateLayer = (layer) => {
      const isMode = !transformStates.transform.value || !transformStates.rotate.value;
      const count = selectedLayer.value.length
      if (isMode && count === 0) {
        emitEvent('update-layer', layer);
        console.log('Layer aktualisiert');
      }
      else {
          console.log('Keine Änderungen gefunden, Update nicht nötig');
        }
    };

    const toggleSelection = (layer, event) => {
      event.preventDefault();
      const index = selectedLayer.value.findIndex(l => l.id === layer.id);
      if (event.ctrlKey) {
        if (index === -1) {
          selectedLayer.value.push(layer)
        } else {
          selectedLayer.value.splice(index, 1);
        }
      } else {
        selectedLayer.value = [layer]
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
      transformState.size = false;
      transformState.rotate = false;
      document.removeEventListener("mouseup", stopTransform);
    };


    const handleMouseMove = (event) => {
      // Berechne die tatsächliche Mausposition relativ zum Canvas Container
      const rect = canvasContainer.value.getBoundingClientRect();
      const scaledX = (event.clientX - rect.left);
      const scaledY = (event.clientY - rect.top);

      cursor.value.x = Math.round(scaledX);
      cursor.value.y = Math.round(scaledY);

      const dx = (event.clientX - lastMouse.value.x);
      const dy = (event.clientY - lastMouse.value.y);

      if (transformStates.transform.value) {
        selectedLayer.value.forEach(layer => {
          layer.x += dx;
          layer.y += dy;
        });
      } else if (canvasStates.transform.value) {
        offset.value.x += dx;
        offset.value.y += dy;
      }
      // Resizing
      else if (transformState.size) {
        handleResize(dx, dy);
      }
      // Rotation
      else if (transformState.rotate) {
        handleRotate(event);
      }

      lastMouse.value.x = event.clientX;
      lastMouse.value.y = event.clientY;
    };

    const startPan = (event) => {
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
      if (event.key.toLowerCase() === "r") {
        //rotateSelectedLayers();
      }
      if (event.key === "w") {
        canvasStates.select.value = !canvasStates.select.value;
      }
      if (event.key === 'g') {
        if (selectedLayer.value.length) {
          transformStates.transform.value = true;
        } else {
          canvasStates.transform.value = true;
        }
      }
      if (event.key === 'z') canvasStates.zoom.value = !canvasStates.zoom.value;
    };

    const handleKeyUp = (event) => {
      if (event.key === 'g') {
        canvasStates.transform.value = false;
        transformStates.transform.value = false;
      }
    };

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
    };
  },
});
</script>

<style scoped lang="scss">
@import 'Grid.scss';
</style>