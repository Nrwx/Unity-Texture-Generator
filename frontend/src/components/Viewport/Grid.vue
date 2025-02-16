<template>
  <div class="viewport-wrapper" @mousedown="resetSelection">
    <!-- Hauptcontainer: Zentriert das Canvas -->
    <div class="main-layer">
      <!-- Lineale -->
      <div class="ruler x-axis d-flex" @mousedown="startGuide('horizontal', $event)">
        <div class="d-flex align-center ma-auto" style="height: 100%;" :style="{ width: `${settings.width * scale}px`, transform: `translateX(${offsetX}px)` }">
          <div
              v-for="x in columnPositions"
              :key="x"
              class="ruler-mark"
              :style="{ width: `${50 * scale}px`}"
          >
            {{ Math.round(x) }}
          </div>
        </div>
      </div>

      <div class="ruler y-axis d-flex" @mousedown="startGuide('vertical', $event)">
        <div class="d-flex flex-column align-center ma-auto" style="width: 100%;" :style="{ height: `${settings.height * scale}px`, transform: `translateY(${offsetY}px)` }">
          <div
              v-for="y in rowPositions"
              :key="y"
              class="ruler-mark"
              :style="{ height: `${50 * scale}px`}"
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
                :selected-layers="selectedLayers"
                :offset-x="isMovingSelection ? offsetX : ''"
                :offset-y="isMovingSelection ? offsetY : ''"
                @component-event="emitEvent"
                @update:select-layer="toggleSelection"
            >
              <!-- Transformations-Overlay -->
              <template #menu>
                <div v-if="transformMode" class="selection-overlay">
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
        {{ `X: ${cursorPosition.x}, Y: ${cursorPosition.y}` }}
      </div>
    </div>
  </div>
</template>

<script>
import { computed, defineComponent, onMounted, onUnmounted, ref } from "vue";
import Image from "@/components/Image/Image";

export default defineComponent({
  name: "PhotoshopGrid",
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
  setup(props, emit) {
    const canvasContainer = ref(null);
    const isPanning = ref(false);
    const isMovingSelection = ref(false);
    const isZooming = ref(false);
    const scale = ref(1);
    const offsetX = ref(0);
    const offsetY = ref(0);
    const cursorPosition = ref({ x: 0, y: 0 });
    let lastMouseX = 0;
    let lastMouseY = 0;
    const guides = ref([]);
    let draggingGuide = null;
    const selectMode = ref(false);
    const selectedLayers = ref([]);
    const transformMode = computed(() => selectedLayers.value.length > 0);
    let isResizing = ref(false);
    let isRotating = ref(false);
    let resizeDirection = ref('');
    let rotationStartAngle = ref(0);

    // Start Resize
    const startResize = (corner, event) => {
      isResizing.value = true;
      resizeDirection.value = corner;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      document.addEventListener("mouseup", stopTransform);
    };

    // Start Rotate
    const startRotate = (direction, event) => {
      isRotating.value = true;
      rotationStartAngle.value = calculateRotation(event.clientX, event.clientY);
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      document.addEventListener("mouseup", stopTransform);
    };

    // Berechnung der Rotation im Grad
    const calculateRotation = (mouseX, mouseY) => {
      const centerX = selectedLayers.value[0].x + selectedLayers.value[0].width / 2;
      const centerY = selectedLayers.value[0].y + selectedLayers.value[0].height / 2;
      const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
      return angle * (180 / Math.PI); // Umwandlung von Bogenmaß zu Grad
    };

    // Berechnung des Resize-Verhältnisses
    const handleResize = (dx, dy) => {
      selectedLayers.value.forEach(layer => {
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

      selectedLayers.value.forEach(layer => {
        layer.rotate += deltaAngle;
      });
      rotationStartAngle.value = currentAngle; // Setze den Startwinkel zurück
    };

    const resetSelection = (event) => {
      if (!canvasContainer.value.contains(event.target)) {
        selectedLayers.value = [];
      }
    };

    const toggleSelection = (layer, event) => {
      event.preventDefault();
      if (!selectMode.value) return;
      if (event.ctrlKey) {
        const index = selectedLayers.value.findIndex(l => l.id === layer.id);
        if (index === -1) {
          selectedLayers.value.push(layer);
        } else {
          selectedLayers.value.splice(index, 1);
        }
      } else {
        selectedLayers.value = [layer];
      }
    };

    const emitEvent = (event, payload) => {
      emit("component-event", event, payload);
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
      transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
      transformOrigin: "center center",
    }));

    const handleMouseDown = (event) => {
      const clickedInsideCanvas = event.target.closest('.canvas-container');

      if (!clickedInsideCanvas) {
        selectedLayers.value = []; // Alle Layer deselektieren
        return;
      }

      if (selectMode.value) {
        return;
      }
      if (isZooming.value) {
        if (event.button === 0) {
          scale.value = Math.min(scale.value + 0.1, 2);
        } else if (event.button === 2) {
          event.preventDefault();
          scale.value = Math.max(scale.value - 0.1, 0.5);
        }
      }
    };


    // Stop Transform (Resizing or Rotating)
    const stopTransform = () => {
      isResizing.value = false;
      isRotating.value = false;
      document.removeEventListener("mouseup", stopTransform);
    };


    const handleMouseMove = (event) => {
      const rect = canvasContainer.value.getBoundingClientRect();
      const x = (event.clientX - rect.left) / scale.value;
      const y = (event.clientY - rect.top) / scale.value;

      cursorPosition.value.x = Math.round(x);
      cursorPosition.value.y = Math.round(y);

      const dx = event.clientX - lastMouseX;
      const dy = event.clientY - lastMouseY;

      if (isMovingSelection.value) {
        selectedLayers.value.forEach(layer => {
          layer.x += dx / scale.value;
          layer.y += dy / scale.value;
        });
      } else if (isPanning.value) {
        offsetX.value += dx;
        offsetY.value += dy;
      }
      // Resizing
      else if (isResizing.value) {
        handleResize(dx / scale.value, dy / scale.value);
      }
      // Rotation
      else if (isRotating.value) {
        handleRotate(event);
      }

      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
    };

    const startPan = (event) => {
      if (!isPanning.value) return;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stopPan);
    };

    const stopPan = () => {
      isPanning.value = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopPan);
    };

    const startDraggingGuide = (guide, event) => {
      event.preventDefault();
      draggingGuide = guide;
      document.addEventListener("mousemove", dragGuide);
      document.addEventListener("mouseup", stopDraggingGuide);
    };

    const startGuide = (type, event) => {
      const position = type === 'horizontal' ? event.clientY : event.clientX;

      // Prüfen, ob eine bestehende Hilfslinie an dieser Position existiert
      const existingIndex = guides.value.findIndex(g => g.type === type && Math.abs(g.position - position) < 5);

      if (existingIndex !== -1) {
        // Entferne die bestehende Hilfslinie
        guides.value.splice(existingIndex, 1);
      } else {
        // Neue Hilfslinie erstellen
        const guide = { id: Date.now(), type, position };
        guides.value.push(guide);
        startDraggingGuide(guide, event);
      }
    };

    const dragGuide = (event) => {
      if (!draggingGuide) return;

      // Verhindere, dass position unnötig auf 0 gesetzt wird
      const newPosition = draggingGuide.type === 'horizontal' ? event.clientY : event.clientX;

      // Nur aktualisieren, wenn sich die Position wirklich ändert
      if (draggingGuide.position !== newPosition) {
        draggingGuide.position = newPosition;
      }
    };

    const stopDraggingGuide = () => {
      if (!draggingGuide) return;

      // Prüfen, ob die Hilfslinie auf das Lineal zurückgelegt wurde
      const isOnXAxis = draggingGuide.type === 'horizontal' && draggingGuide.position <= 20; // 20px Toleranz für das Lineal
      const isOnYAxis = draggingGuide.type === 'vertical' && draggingGuide.position <= 20;

      if (isOnXAxis || isOnYAxis) {
        // Lösche die Hilfslinie
        guides.value = guides.value.filter(g => g.id !== draggingGuide.id);
      }

      draggingGuide = null;
      document.removeEventListener("mousemove", dragGuide);
      document.removeEventListener("mouseup", stopDraggingGuide);
    };

    const getGuideStyle = (guide) => {
      return guide.type === 'horizontal'
          ? { top: `${guide.position}px`, bottom: '0', left: '0', right: '0', width: '100%', height: '1px', background: 'blue', position: 'absolute', cursor: 'row-resize' }
          : { left: `${guide.position}px`, bottom: '0', top: '0', right: '0', height: '100%', width: '1px', background: 'blue', position: 'absolute', cursor: 'col-resize' };
    };

    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() === "r") {
        //rotateSelectedLayers();
      }
      if (event.key === "w") {
        selectMode.value = !selectMode.value;
      }
      if (event.key === 'g') {
        if (selectedLayers.value.length > 0) {
          isMovingSelection.value = true;
        } else {
          isPanning.value = true;
        }
      }
      if (event.key === 'z') isZooming.value = !isZooming.value;
    };

    const handleKeyUp = (event) => {
      if (event.key === 'g') {
        isPanning.value = false;
        isMovingSelection.value = false;
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
      canvasContainer,
      canvasContainerStyle,
      handleMouseDown,
      handleMouseMove,
      cursorPosition,
      offsetX,
      offsetY,
      scale,
      columnPositions,
      rowPositions,
      guides,
      startGuide,
      startDraggingGuide,
      getGuideStyle,
      isZooming,
      emitEvent,
      selectMode,
      selectedLayers,
      toggleSelection,
      isMovingSelection,
      resetSelection,
      transformMode,
      startRotate,
      startResize,
    };
  },
});
</script>

<style scoped lang="scss">
@import 'Grid.scss';
</style>