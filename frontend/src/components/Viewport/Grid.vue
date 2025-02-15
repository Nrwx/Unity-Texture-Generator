<template>
  <div class="viewport-wrapper">
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
            />
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
      document.addEventListener("contextmenu", (event) => event.preventDefault());
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("keyup", handleKeyUp);
      document.addEventListener("mousedown", startPan);
    });

    onUnmounted(() => {
      document.removeEventListener("contextmenu", (event) => event.preventDefault());
      document.removeEventListener("keydown", handleKeyDown);
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
    };
  },
});
</script>

<style scoped lang="scss">
@import 'Grid.scss';
</style>