<template>
  <Dialog
      :state="state"
      :loading="loading"
      :theme="theme"
      :data="config"
      @update:component-event="emitEvent"
  >
    <template #header>
      <div class="mem-header">
        <div class="mem-title">
          <v-icon size="18">mdi-cube-scan</v-icon>

          <div>
            <strong>Material Editor</strong>
            <span>{{ materialModeLabel }} · {{ sourceLayerName }}</span>
          </div>
        </div>

        <div
            class="mem-status"
            :class="{ active: materialConnected }"
        >
          <span />
          {{ materialConnected ? "Material Connected" : "Material Disconnected" }}
        </div>
      </div>
    </template>

    <template #content>
      <div
          class="mem-content"
          :class="{ 'workspace-full': isFullWorkspaceTab }"
      >
        <section
            v-if="!isFullWorkspaceTab"
            class="mem-preview"
        >
          <div class="mem-preview-head">
            <div>
              <span>Canvas Material Preview</span>
              <strong>{{ imageSizeLabel }}</strong>
            </div>

            <button
                type="button"
                class="mem-ghost-btn"
                :disabled="loadingPreview"
                @click="requestPreviewNow"
            >
              Aktualisieren
            </button>
          </div>

          <div class="mem-stage">
            <div class="mem-cube-shell">
              <Layer3D
                  v-if="materialConnected"
                  :layer="previewLayer"
                  :rotate="values.rotate_preview"
                  :selected="false"
                  class="mem-preview-cube"
              />

              <div
                  v-else
                  class="mem-disconnected-preview"
              >
                <v-icon size="34">mdi-vector-link-off</v-icon>
                <strong>Material Output getrennt</strong>
                <span>Verbinde Shader → Output, um das Material wieder anzuzeigen.</span>
              </div>

              <div class="mem-cube-glow" />

              <div
                  v-if="loadingPreview"
                  class="mem-preview-loading"
              >
                <v-progress-circular
                    indeterminate
                    size="28"
                />

                <span>Material wird vorbereitet…</span>
              </div>
            </div>
          </div>

          <div
              class="mem-material-slot"
              :class="{ active: sourceLayerThumbnail }"
              @dragover.prevent
              @drop="handleMapDrop($event, 'baseColor')"
          >
            <div class="mem-slot-preview">
              <v-img
                  v-if="sourceLayerThumbnail"
                  :src="sourceLayerThumbnail"
                  :alt="sourceLayerName"
                  cover
              />

              <v-icon v-else size="28">mdi-image-off-outline</v-icon>
            </div>

            <div class="mem-slot-text">
              <strong>Base Texture Slot</strong>
              <span>{{ sourceLayerName }}</span>
              <small>Layer hineinziehen oder im Surface/Shader zuweisen.</small>
            </div>

            <v-icon size="20">mdi-tray-arrow-down</v-icon>
          </div>

          <div class="mem-meta">
            <div>
              <span>Shader</span>
              <strong>{{ materialConnected ? "Connected" : "Disconnected" }}</strong>
            </div>

            <div>
              <span>Nodes</span>
              <strong>{{ values.shader_graph.nodes.length }}</strong>
            </div>

            <div>
              <span>Edges</span>
              <strong>{{ values.shader_graph.edges.length }}</strong>
            </div>
          </div>
        </section>

        <section class="mem-workspace">
          <nav class="mem-tabs">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                class="mem-tab"
                :class="{ active: ui.activeTab === tab.key }"
                @click="ui.activeTab = tab.key"
            >
              <v-icon size="18">{{ tab.icon }}</v-icon>
              <span>{{ tab.title }}</span>
            </button>
          </nav>

          <div class="mem-view">
            <!-- SURFACE -->
            <template v-if="ui.activeTab === 'surface'">
              <div class="mem-view-head">
                <div>
                  <strong>Surface</strong>
                  <span>Alle Principled-BSDF-Werte mit Bitmap-Slot, Offset und Node-Insertion.</span>
                </div>
              </div>

              <div class="mem-section">
                <div class="mem-name-card">
                  <strong>Material Name</strong>

                  <v-text-field
                      v-model="values.name"
                      label="Name"
                      density="compact"
                      hide-details
                  />
                </div>

                <div class="mem-layer-bank">
                  <header>
                    <strong>Bitmap Layers</strong>
                    <small>In einen Surface-Slot ziehen.</small>
                  </header>

                  <div class="mem-layer-bank-list">
                    <button
                        v-for="item in textureLayers"
                        :key="item.id"
                        type="button"
                        class="mem-layer-source-item"
                        draggable="true"
                        @dragstart="handleLayerDragStart($event, item)"
                    >
                      <span class="mem-layer-thumb">
                        <v-img
                            v-if="item.masked || item.thumbnail || item.url || item.svg"
                            :src="item.masked || item.thumbnail || item.url || item.svg"
                            :alt="item.name"
                            cover
                        />

                        <v-icon v-else size="18">
                          {{ item.type === 5 ? "mdi-cube-outline" : "mdi-image-outline" }}
                        </v-icon>
                      </span>

                      <span class="mem-layer-source-main">
                        <strong>{{ item.name || item.id }}</strong>
                        <small>type {{ item.type }}</small>
                      </span>
                    </button>
                  </div>
                </div>

                <div
                    v-for="field in surfaceFields"
                    :key="field.key"
                    class="mem-surface-row"
                    :class="{ active: getMapSlot(field.key)?.enabled }"
                    @dragover.prevent
                    @drop="handleMapDrop($event, field.key)"
                >
                  <header>
                    <strong>{{ field.label }}</strong>
                    <small>{{ field.key }}</small>
                  </header>

                  <template v-if="field.type === 'color'">
                    <div class="mem-color-line">
                      <input
                          type="color"
                          :value="getSurfaceColor(field.key)"
                          @input="setSurfaceColor(field.key, $event.target.value)"
                      />

                      <span>{{ getSurfaceColor(field.key) }}</span>
                    </div>
                  </template>

                  <template v-else-if="field.type === 'vector3'">
                    <div class="mem-vector-row">
                      <v-text-field
                          v-model.number="values.surface[field.key][0]"
                          label="X"
                          density="compact"
                          hide-details
                      />

                      <v-text-field
                          v-model.number="values.surface[field.key][1]"
                          label="Y"
                          density="compact"
                          hide-details
                      />

                      <v-text-field
                          v-model.number="values.surface[field.key][2]"
                          label="Z"
                          density="compact"
                          hide-details
                      />
                    </div>
                  </template>

                  <template v-else>
                    <v-slider
                        v-model="values.surface[field.key]"
                        :min="field.min"
                        :max="field.max"
                        :step="field.step"
                        thumb-label
                        hide-details
                    />
                  </template>

                  <div class="mem-surface-map-slot">
                    <button
                        type="button"
                        class="mem-map-pill"
                        :class="{
                          active: isSurfaceSlotConnected(field.key),
                          multitexture: getMapSlot(field.key)?.source_type === 'multitexture',
                          shader: getMapSlot(field.key)?.source_type === 'shader'
                        }"
                        @click="clearMapSlot(field.key)"
                    >
                      <v-icon size="15">
                        {{ getSurfaceSlotIcon(field.key) }}
                      </v-icon>

                      <span class="mem-map-pill-text">
                        <strong>{{ getSurfaceSlotLabel(field.key) }}</strong>
                        <small>{{ getSurfaceSlotDetail(field.key) }}</small>
                      </span>
                    </button>

                    <div class="mem-surface-offset-sync">
                      <v-slider
                          :model-value="getSurfaceSlotOffset(field.key)"
                          :min="-1"
                          :max="1"
                          :step="0.001"
                          thumb-label
                          hide-details
                          @update:model-value="setSurfaceSlotOffset(field.key, $event)"
                      />

                      <v-text-field
                          :model-value="getSurfaceSlotOffset(field.key)"
                          label="Offset"
                          type="number"
                          density="compact"
                          hide-details
                          @update:model-value="setSurfaceSlotOffset(field.key, $event)"
                      />

                      <v-select
                          :model-value="getMapSlot(field.key)?.channel || 'rgba'"
                          :items="['rgba', 'rgb']"
                          label="Mode"
                          density="compact"
                          hide-details
                          @update:model-value="setSurfaceSlotChannel(field.key, $event)"
                      />
                    </div>

                    <div class="mem-slot-node-actions">
                      <button
                          type="button"
                          class="mem-mini-btn"
                          :disabled="!getMapSlot(field.key)?.enabled"
                          @click="insertNodeBetweenSurfaceSlot(field.key, 'modifier')"
                      >
                        Modifier
                      </button>

                      <button
                          type="button"
                          class="mem-mini-btn"
                          :disabled="!getMapSlot(field.key)?.enabled"
                          @click="insertNodeBetweenSurfaceSlot(field.key, 'falloff')"
                      >
                        Falloff
                      </button>

                      <button
                          type="button"
                          class="mem-mini-btn"
                          :disabled="!getMapSlot(field.key)?.enabled"
                          @click="insertNodeBetweenSurfaceSlot(field.key, 'filter')"
                      >
                        Filter
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- GEOMETRY -->
            <template v-else-if="ui.activeTab === 'geometry'">
              <div class="mem-view-head">
                <div>
                  <strong>Geometry</strong>
                  <span>Form, Proportionen, Bevel, Subdivision, Displacement und UV-Dichte.</span>
                </div>
              </div>

              <div class="mem-geometry-layout">
                <section class="mem-geometry-card">
                  <header>
                    <strong>Primitive</strong>
                    <small>Basisform und globale Abmessungen.</small>
                  </header>

                  <v-select
                      v-model="values.geometry.primitive"
                      :items="['cube', 'box', 'plane', 'sphere', 'cylinder']"
                      label="Primitive"
                      density="compact"
                      hide-details
                      @update:model-value="requestPreviewDebounced"
                  />

                  <div class="mem-geometry-vector">
                    <v-text-field
                        v-model.number="values.geometry.width"
                        label="Width"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />

                    <v-text-field
                        v-model.number="values.geometry.height"
                        label="Height"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />

                    <v-text-field
                        v-model.number="values.geometry.depth"
                        label="Depth"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>
                </section>

                <section class="mem-geometry-card">
                  <header>
                    <strong>Bevel & Subdivision</strong>
                    <small>Kanten, Glättung und geometrische Auflösung.</small>
                  </header>

                  <div class="mem-control-card">
                    <header>
                      <strong>Bevel</strong>
                      <small>{{ values.geometry.bevel }}</small>
                    </header>

                    <v-slider
                        v-model="values.geometry.bevel"
                        :min="0"
                        :max="0.5"
                        :step="0.001"
                        thumb-label
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>

                  <div class="mem-control-card">
                    <header>
                      <strong>Bevel Segments</strong>
                      <small>{{ values.geometry.bevel_segments }}</small>
                    </header>

                    <v-slider
                        v-model="values.geometry.bevel_segments"
                        :min="1"
                        :max="12"
                        :step="1"
                        thumb-label
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>

                  <div class="mem-control-card">
                    <header>
                      <strong>Subdivision</strong>
                      <small>{{ values.geometry.subdivision }}</small>
                    </header>

                    <v-slider
                        v-model="values.geometry.subdivision"
                        :min="0"
                        :max="6"
                        :step="1"
                        thumb-label
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>

                  <label
                      class="mem-toggle-card"
                      :class="{ active: values.geometry.shade_smooth }"
                  >
                    <span class="mem-toggle-icon">
                      <v-icon>mdi-blur</v-icon>
                    </span>

                    <span class="mem-toggle-text">
                      <strong>Shade Smooth</strong>
                      <small>Glättet die sichtbare Flächeninterpolation.</small>
                    </span>

                    <v-switch
                        v-model="values.geometry.shade_smooth"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </label>
                </section>

                <section class="mem-geometry-card">
                  <header>
                    <strong>Displacement & Normal</strong>
                    <small>Geometrische Tiefe und Oberflächenstruktur.</small>
                  </header>

                  <label
                      class="mem-toggle-card"
                      :class="{ active: values.geometry.displacement_enabled }"
                  >
                    <span class="mem-toggle-icon">
                      <v-icon>mdi-terrain</v-icon>
                    </span>

                    <span class="mem-toggle-text">
                      <strong>Displacement</strong>
                      <small>Aktiviert Höhenversatz über Materialdaten.</small>
                    </span>

                    <v-switch
                        v-model="values.geometry.displacement_enabled"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </label>

                  <div class="mem-control-card">
                    <header>
                      <strong>Displacement Strength</strong>
                      <small>{{ values.geometry.displacement_strength }}</small>
                    </header>

                    <v-slider
                        v-model="values.geometry.displacement_strength"
                        :min="0"
                        :max="2"
                        :step="0.001"
                        thumb-label
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>

                  <div class="mem-control-card">
                    <header>
                      <strong>Midlevel</strong>
                      <small>{{ values.geometry.displacement_midlevel }}</small>
                    </header>

                    <v-slider
                        v-model="values.geometry.displacement_midlevel"
                        :min="0"
                        :max="1"
                        :step="0.001"
                        thumb-label
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>

                  <div class="mem-control-card">
                    <header>
                      <strong>Normal Strength</strong>
                      <small>{{ values.geometry.normal_strength }}</small>
                    </header>

                    <v-slider
                        v-model="values.geometry.normal_strength"
                        :min="0"
                        :max="4"
                        :step="0.001"
                        thumb-label
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>

                  <div class="mem-control-card">
                    <header>
                      <strong>Bump Strength</strong>
                      <small>{{ values.geometry.bump_strength }}</small>
                    </header>

                    <v-slider
                        v-model="values.geometry.bump_strength"
                        :min="0"
                        :max="2"
                        :step="0.001"
                        thumb-label
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>
                </section>

                <section class="mem-geometry-card">
                  <header>
                    <strong>UV Geometry Binding</strong>
                    <small>Wie UV-Daten auf die Geometrie verteilt werden.</small>
                  </header>

                  <v-select
                      v-model="values.geometry.uv_fit"
                      :items="['stretch', 'contain', 'cover', 'tile', 'world']"
                      label="UV Fit"
                      density="compact"
                      hide-details
                      @update:model-value="requestPreviewDebounced"
                  />

                  <div class="mem-control-card">
                    <header>
                      <strong>UV Density</strong>
                      <small>{{ values.geometry.uv_density }}</small>
                    </header>

                    <v-slider
                        v-model="values.geometry.uv_density"
                        :min="0.1"
                        :max="10"
                        :step="0.001"
                        thumb-label
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>
                </section>

                <section class="mem-geometry-card wide">
                  <header>
                    <strong>Transform</strong>
                    <small>Pivot, Rotation und Skalierung der Material-Geometrie.</small>
                  </header>

                  <div class="mem-geometry-vector">
                    <v-text-field
                        v-model.number="values.geometry.pivot_x"
                        label="Pivot X"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />

                    <v-text-field
                        v-model.number="values.geometry.pivot_y"
                        label="Pivot Y"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />

                    <v-text-field
                        v-model.number="values.geometry.pivot_z"
                        label="Pivot Z"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>

                  <div class="mem-geometry-vector">
                    <v-text-field
                        v-model.number="values.geometry.rotation_x"
                        label="Rot X"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />

                    <v-text-field
                        v-model.number="values.geometry.rotation_y"
                        label="Rot Y"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />

                    <v-text-field
                        v-model.number="values.geometry.rotation_z"
                        label="Rot Z"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>

                  <div class="mem-geometry-vector">
                    <v-text-field
                        v-model.number="values.geometry.scale_x"
                        label="Scale X"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />

                    <v-text-field
                        v-model.number="values.geometry.scale_y"
                        label="Scale Y"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />

                    <v-text-field
                        v-model.number="values.geometry.scale_z"
                        label="Scale Z"
                        type="number"
                        density="compact"
                        hide-details
                        @update:model-value="requestPreviewDebounced"
                    />
                  </div>
                </section>
              </div>
            </template>

            <!-- UV -->
            <template v-else-if="ui.activeTab === 'uv'">
              <div class="mem-uv-workbench">
                <!-- TOP BAR -->
                <header class="mem-uv-toolbar">
                  <div class="mem-uv-toolbar-title">
                    <v-icon size="18">mdi-vector-square</v-icon>

                    <div>
                      <strong>UV Layout Editor</strong>
                      <span>
            {{ uvViewModeLabel }} · {{ selectedUvFaces.length }} selected · {{ Math.round(uvViewport.zoom * 100) }}%
          </span>
                    </div>
                  </div>

                  <div class="mem-uv-toolbar-actions">
                    <button
                        type="button"
                        class="mem-ghost-btn"
                        :class="{ active: values.uv.view_mode === 'face' }"
                        @click="values.uv.view_mode = 'face'; drawUvCanvas()"
                    >
                      Face View
                    </button>

                    <button
                        type="button"
                        class="mem-ghost-btn"
                        :class="{ active: values.uv.view_mode === 'cubemap' }"
                        @click="values.uv.view_mode = 'cubemap'; drawUvCanvas()"
                    >
                      CubeMap View
                    </button>

                    <button
                        type="button"
                        class="mem-ghost-btn"
                        @click="selectAllUvFaces"
                    >
                      Select All
                    </button>

                    <button
                        type="button"
                        class="mem-ghost-btn"
                        @click="resetUvViewport"
                    >
                      Fit
                    </button>

                    <button
                        type="button"
                        class="mem-ghost-btn"
                        @click="resetSelectedUvFaces"
                    >
                      Reset
                    </button>
                  </div>
                </header>

                <!-- MAIN -->
                <div class="mem-uv-main-grid">
                  <!-- LEFT: CANVAS -->
                  <section class="mem-uv-card mem-uv-canvas-card">
                    <div
                        ref="uvViewportRef"
                        class="mem-uv-canvas-stage"
                        @mousedown="startUvPan"
                        @wheel.prevent="handleUvWheel"
                    >
                      <canvas
                          ref="uvCanvasRef"
                          class="mem-uv-live-canvas"
                          :style="uvCanvasStyle"
                      />

                      <div class="mem-uv-canvas-hud">
                        {{ Math.round(uvViewport.zoom * 100) }}%
                      </div>

                      <div class="mem-uv-canvas-hud mem-uv-face-hud">
                        {{ values.uv.view_mode === 'cubemap' ? 'CUBEMAP' : values.uv.active_face }}
                      </div>
                    </div>
                  </section>

                  <!-- RIGHT: CUBEMAP + INSPECTOR -->
                  <section class="mem-uv-side-column">
                    <section class="mem-uv-card mem-uv-cubemap-card">
                      <header class="mem-uv-card-head">
                        <div>
                          <strong>CubeMap Grid</strong>
                          <span>Wähle eine oder mehrere Faces.</span>
                        </div>
                      </header>

                      <div class="mem-uv-cubemap">
                        <button
                            v-for="item in uvFaceLayout"
                            :key="item.face"
                            type="button"
                            class="mem-uv-face-box"
                            :class="{
                  active: values.uv.active_face === item.face,
                  selected: isUvFaceSelected(item.face),
                  mapped: Boolean(values.uv.faces[item.face]?.bitmap?.url)
                }"
                            :style="{
                  gridColumn: item.col,
                  gridRow: item.row
                }"
                            @click="toggleUvFaceSelection(item.face, $event)"
                        >
                          <strong>{{ item.face }}</strong>

                          <small v-if="values.uv.faces[item.face]?.bitmap?.name">
                            {{ values.uv.faces[item.face].bitmap.name }}
                          </small>

                          <small v-else>
                            no bitmap
                          </small>
                        </button>
                      </div>
                    </section>

                    <section class="mem-uv-card mem-uv-inspector-card">
                      <header class="mem-uv-card-head">
                        <div>
                          <strong>Face Inspector</strong>
                          <span>{{ values.uv.active_face }} · {{ activeUvFaceBitmapName }}</span>
                        </div>

                        <v-select
                            v-model="values.uv.active_face"
                            :items="['front', 'back', 'left', 'right', 'top', 'bottom']"
                            density="compact"
                            hide-details
                            class="mem-uv-face-select"
                            @update:model-value="setActiveUvFace"
                        />
                      </header>

                      <div class="mem-uv-metrics">
                        <div>
                          <span>POS</span>
                          <strong>{{ uvGridMetrics.x }}, {{ uvGridMetrics.y }}</strong>
                        </div>

                        <div>
                          <span>SIZE</span>
                          <strong>{{ uvGridMetrics.width }} × {{ uvGridMetrics.height }}</strong>
                        </div>

                        <div>
                          <span>MOVE</span>
                          <strong>{{ uvGridMetrics.translateX }}, {{ uvGridMetrics.translateY }}</strong>
                        </div>

                        <div>
                          <span>SCALE</span>
                          <strong>{{ uvGridMetrics.scaleX }} × {{ uvGridMetrics.scaleY }}</strong>
                        </div>

                        <div>
                          <span>ROT</span>
                          <strong>{{ uvGridMetrics.rotate }}°</strong>
                        </div>
                      </div>

                      <div class="mem-uv-control-grid">
                        <div
                            v-for="key in ['x', 'y', 'width', 'height', 'translate_x', 'translate_y', 'scale_x', 'scale_y', 'rotate']"
                            :key="key"
                            class="mem-control-card"
                        >
                          <header>
                            <strong>{{ key }}</strong>
                            <small>{{ activeUvFace[key] }}</small>
                          </header>

                          <v-slider
                              v-model="activeUvFace[key]"
                              :min="key === 'rotate' ? -360 : key.includes('scale') ? 0.01 : key.includes('translate') ? -2 : 0"
                              :max="key === 'rotate' ? 360 : key.includes('scale') ? 10 : key.includes('translate') ? 2 : 1"
                              :step="key === 'rotate' ? 1 : 0.001"
                              thumb-label
                              hide-details
                              @update:model-value="syncUvAndPreview"
                          />
                        </div>
                      </div>

                      <div class="mem-uv-toggle-row">
                        <label
                            class="mem-toggle-card"
                            :class="{ active: (getMapSlot('baseColor')?.channel || 'rgba') === 'rgba' }"
                        >
              <span class="mem-toggle-icon">
                <v-icon>mdi-alpha-a-box-outline</v-icon>
              </span>

                          <span class="mem-toggle-text">
                <strong>Bitmap Mode</strong>
              </span>

                          <v-select
                              :model-value="getMapSlot('baseColor')?.channel || 'rgba'"
                              :items="['rgba', 'rgb']"
                              density="compact"
                              hide-details
                              @update:model-value="setSurfaceSlotChannel('baseColor', $event)"
                          />
                        </label>

                        <label
                            class="mem-toggle-card"
                            :class="{ active: activeUvFace.flip_x }"
                        >
              <span class="mem-toggle-icon">
                <v-icon>mdi-flip-horizontal</v-icon>
              </span>

                          <span class="mem-toggle-text">
                <strong>Flip X</strong>
              </span>

                          <v-switch
                              v-model="activeUvFace.flip_x"
                              hide-details
                              @update:model-value="syncUvAndPreview"
                          />
                        </label>

                        <label
                            class="mem-toggle-card"
                            :class="{ active: activeUvFace.flip_y }"
                        >
              <span class="mem-toggle-icon">
                <v-icon>mdi-flip-vertical</v-icon>
              </span>

                          <span class="mem-toggle-text">
                <strong>Flip Y</strong>
              </span>

                          <v-switch
                              v-model="activeUvFace.flip_y"
                              hide-details
                              @update:model-value="syncUvAndPreview"
                          />
                        </label>
                      </div>
                    </section>
                  </section>
                </div>

                <!-- BOTTOM: LAYERS + REFERENCE -->
                <section class="mem-uv-card mem-uv-assets-card">
                  <header class="mem-uv-card-head">
                    <div>
                      <strong>Face Bitmap Assignment</strong>
                      <span>
            Bitmap wird den selektierten Faces zugewiesen.
            Aktuell: {{ selectedUvFaces.join(', ') }}
          </span>
                    </div>
                  </header>

                  <div class="mem-uv-assets-grid">
                    <section class="mem-uv-layer-bank">
                      <button
                          v-for="item in textureLayers"
                          :key="item.id"
                          type="button"
                          class="mem-layer-source-item"
                          :class="{ active: isLayerAssignedToSelectedUvFaces(item.id) }"
                          draggable="true"
                          @dragstart="handleLayerDragStart($event, item)"
                          @click="assignLayerToSelectedUvFaces(item)"
                      >
            <span class="mem-layer-thumb">
              <v-img
                  v-if="item.masked || item.thumbnail || item.url || item.svg"
                  :src="item.masked || item.thumbnail || item.url || item.svg"
                  :alt="item.name"
                  cover
              />

              <v-icon v-else size="18">
                {{ item.type === 5 ? 'mdi-cube-outline' : 'mdi-image-outline' }}
              </v-icon>
            </span>

                        <span class="mem-layer-source-main">
              <strong>{{ item.name || item.id }}</strong>
              <small>{{ item.width || 0 }} × {{ item.height || 0 }}</small>
            </span>
                      </button>
                    </section>

                    <aside class="mem-uv-reference-card">
                      <header>
                        <strong>Bitmap Reference</strong>
                        <span>{{ activeUvFaceBitmapName }}</span>
                      </header>

                      <div class="mem-uv-reference-frame">
                        <img
                            v-if="activeUvFaceBitmapUrl"
                            :src="activeUvFaceBitmapUrl"
                            alt="Selected Face Bitmap Reference"
                        />

                        <v-icon v-else size="30">mdi-image-off-outline</v-icon>
                      </div>
                    </aside>
                  </div>
                </section>
              </div>
            </template>

            <!-- SHADER -->
            <template v-else-if="ui.activeTab === 'shader'">
              <div class="mem-view-head">
                <div>
                  <strong>Shader Graph</strong>
                  <span>Principled BSDF ist immer mit Material Output verbunden, solange gerendert werden soll.</span>
                </div>

                <div class="mem-node-actions">
                  <button
                      v-for="nodeType in nodeTypes"
                      :key="nodeType.type"
                      type="button"
                      class="mem-ghost-btn"
                      @click="addShaderNode(nodeType.type)"
                  >
                    <v-icon size="14">{{ nodeType.icon }}</v-icon>
                    {{ nodeType.label }}
                  </button>
                </div>
              </div>

              <div class="mem-shader-layout">
                <aside class="mem-shader-source-panel">
                  <strong>Layer Bitmaps</strong>
                  <small>Auf Bitmap-Nodes oder Surface-Slots ziehen.</small>

                  <button
                      v-for="item in textureLayers"
                      :key="item.id"
                      type="button"
                      class="mem-layer-source-item"
                      draggable="true"
                      @dragstart="handleLayerDragStart($event, item)"
                  >
                    <span class="mem-layer-thumb">
                      <v-img
                          v-if="item.masked || item.thumbnail || item.url || item.svg"
                          :src="item.masked || item.thumbnail || item.url || item.svg"
                          :alt="item.name"
                          cover
                      />

                      <v-icon v-else size="18">
                        {{ item.type === 5 ? "mdi-cube-outline" : "mdi-image-outline" }}
                      </v-icon>
                    </span>

                    <span class="mem-layer-source-main">
                      <strong>{{ item.name || item.id }}</strong>
                      <small>type {{ item.type }}</small>
                    </span>
                  </button>
                </aside>

                <section
                    ref="nodeCanvasRef"
                    class="mem-node-canvas"
                    @mousedown="startCanvasPan"
                    @wheel.prevent="handleCanvasWheel"
                >
                  <div
                      class="mem-node-world"
                      :style="nodeWorldStyle"
                  >
                    <div class="mem-node-grid-bg" />

                    <svg class="mem-node-lines">
                      <path
                          v-for="edge in graphEdges"
                          :key="edge.id"
                          :d="edge.path"
                          class="mem-node-line"
                          :class="{
                            core: isCoreEdge(edge),
                            snap: activeSnapEdgeId === edge.id
                          }"
                          @click.stop="disconnectEdge(edge.id)"
                      />

                      <path
                          v-if="activeConnectionPath"
                          :d="activeConnectionPath"
                          class="mem-node-line active"
                      />
                    </svg>

                    <div
                        v-for="node in values.shader_graph.nodes"
                        :key="node.id"
                        class="mem-shader-graph-node"
                        :class="[node.type, { active: activeShaderNodeId === node.id, locked: node.locked }]"
                        :style="{
          left: `${node.position?.x || 0}px`,
          top: `${node.position?.y || 0}px`
        }"
                        @mousedown.stop="startMoveNode($event, node)"
                        @click="activeShaderNodeId = node.id"
                    >
                      <header>
                        <v-icon size="18">
                          {{
                            node.type === 'output'
                                ? 'mdi-export'
                                : node.type === 'principled'
                                    ? 'mdi-material-design'
                                    : node.type === 'bitmap'
                                        ? 'mdi-image'
                                        : node.type === 'uv-map'
                                            ? 'mdi-vector-square'
                                            : node.type === 'falloff'
                                                ? 'mdi-chart-bell-curve'
                                                : node.type === 'blend'
                                                    ? 'mdi-blender-software'
                                                    : node.type === 'filter'
                                                        ? 'mdi-filter'
                                                        : node.type === 'preview'
                                                            ? 'mdi-eye'
                                                            : 'mdi-function'
                          }}
                        </v-icon>

                        <strong>{{ node.label }}</strong>

                        <i class="mem-node-type-badge">
                          {{ getNodeBadge(node) }}
                        </i>

                        <button
                            v-if="!node.locked"
                            type="button"
                            class="mem-node-close"
                            title="Node entfernen"
                            @mousedown.stop
                            @click.stop="removeShaderNode(node.id)"
                        >
                          ×
                        </button>

                      </header>

                      <div class="mem-node-sockets">
                        <div class="mem-node-socket-col">
          <span
              v-for="(socket) in node.inputs"
              :key="`input-${socket}`"
              class="mem-node-socket input"
              data-socket
              @mousedown.stop="startConnection($event, node, socket, 'input')"
              @mouseup.stop="completeConnection($event, node, socket, 'input')"
          >
            <i />
            {{ socket }}
          </span>
                        </div>

                        <div class="mem-node-socket-col right">
          <span
              v-for="(socket) in node.outputs"
              :key="`output-${socket}`"
              class="mem-node-socket output"
              data-socket
              @mousedown.stop="startConnection($event, node, socket, 'output')"
              @mouseup.stop="completeConnection($event, node, socket, 'output')"
          >
            {{ socket }}
            <i />
          </span>
                        </div>
                      </div>

                      <div class="mem-node-value-strip">
                        <span>{{ getNodeValueSummary(node) }}</span>
                      </div>

                      <small class="mem-node-meta">
                        <b>{{ getNodeBadge(node) }}</b>
                        {{ getNodeConnectionSummary(node) }}
                      </small>
                    </div>
                  </div>

                  <div class="mem-node-zoom-indicator">
                    {{ Math.round(nodeCanvas.zoom * 100) }}%
                  </div>
                </section>

                <aside class="mem-node-inspector">
                  <template v-if="activeShaderNode">
                    <strong>{{ activeShaderNode.label }}</strong>
                    <small>{{ activeShaderNode.type }} · {{ getNodeValueSummary(activeShaderNode) }}</small>

                    <v-text-field
                        v-model="activeShaderNode.label"
                        label="Label"
                        density="compact"
                        hide-details
                        :disabled="activeShaderNode.locked"
                        @update:model-value="syncNodeValuesToSurface(activeShaderNode)"
                    />

                    <template v-if="activeShaderNode.type === 'bitmap'">
                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).channel"
                          :items="['rgba', 'rgb']"
                          label="Channel"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'channel', $event)"
                      />

                      <v-text-field
                          :model-value="normalizeNodeSettings(activeShaderNode).name"
                          label="Bitmap Name"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'name', $event)"
                      />
                    </template>

                    <template v-if="activeShaderNode.type === 'multitexture'">
                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).channel"
                          :items="['rgba', 'rgb']"
                          label="Mode"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'channel', $event)"
                      />
                    </template>

                    <template v-if="activeShaderNode.type === 'uv-map'">
                      <v-text-field
                          :model-value="normalizeNodeSettings(activeShaderNode).offset_x"
                          label="Offset X"
                          type="number"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'offset_x', Number($event))"
                      />

                      <v-text-field
                          :model-value="normalizeNodeSettings(activeShaderNode).offset_y"
                          label="Offset Y"
                          type="number"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'offset_y', Number($event))"
                      />

                      <v-text-field
                          :model-value="normalizeNodeSettings(activeShaderNode).rotate"
                          label="Rotate"
                          type="number"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'rotate', Number($event))"
                      />
                    </template>

                    <template v-if="activeShaderNode.type === 'filter'">
                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).filter"
                          :items="['none', 'blur', 'sharpen', 'contrast', 'hue', 'invert', 'grayscale']"
                          label="Filter"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'filter', $event)"
                      />
                    </template>

                    <template v-if="activeShaderNode.type === 'falloff'">
                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).falloff"
                          :items="['smooth', 'sphere', 'root', 'sharp', 'linear', 'constant', 'random', 'inverted']"
                          label="Falloff"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'falloff', $event)"
                      />
                    </template>

                    <template v-if="['blend', 'math', 'modifier'].includes(activeShaderNode.type)">
                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).operation"
                          :items="['none', 'multiply', 'add', 'subtract', 'divide', 'mix', 'screen', 'overlay', 'difference', 'clamp', 'invert']"
                          label="Operation"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'operation', $event)"
                      />
                    </template>

                    <div class="mem-control-card">
                      <header>
                        <strong>Strength</strong>
                        <small>{{ normalizeNodeSettings(activeShaderNode).strength }}</small>
                      </header>

                      <v-slider
                          :model-value="normalizeNodeSettings(activeShaderNode).strength"
                          :min="0"
                          :max="2"
                          :step="0.01"
                          thumb-label
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'strength', $event)"
                      />
                    </div>

                    <div class="mem-control-card">
                      <header>
                        <strong>Offset</strong>
                        <small>{{ normalizeNodeSettings(activeShaderNode).offset }}</small>
                      </header>

                      <v-slider
                          :model-value="normalizeNodeSettings(activeShaderNode).offset"
                          :min="-1"
                          :max="1"
                          :step="0.001"
                          thumb-label
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'offset', $event)"
                      />
                    </div>

                    <label
                        class="mem-toggle-card"
                        :class="{ active: normalizeNodeSettings(activeShaderNode).clamp }"
                    >
    <span class="mem-toggle-icon">
      <v-icon>mdi-lock-outline</v-icon>
    </span>

                      <span class="mem-toggle-text">
      <strong>Clamp</strong>
      <small>Werte auf gültigen Bereich begrenzen.</small>
    </span>

                      <v-switch
                          :model-value="normalizeNodeSettings(activeShaderNode).clamp"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'clamp', $event)"
                      />
                    </label>
                  </template>
                </aside>
              </div>
            </template>

            <!-- EXPORT -->
            <template v-else-if="ui.activeTab === 'export'">
              <div class="mem-view-head">
                <div>
                  <strong>Export</strong>
                  <span>Blender-kompatibles Materialpaket, Shader Graph und UV-Daten.</span>
                </div>

                <button
                    type="button"
                    class="mem-ghost-btn"
                    :disabled="!isEditingMaterialLayer"
                    @click="requestExport"
                >
                  Export anfragen
                </button>
              </div>

              <div class="mem-section">
                <pre class="mem-export-json">{{ JSON.stringify(previewLayer, null, 2) }}</pre>
              </div>
            </template>

            <!-- SETTINGS -->
            <template v-else-if="ui.activeTab === 'settings'">
              <div class="mem-view-head">
                <div>
                  <strong>Settings</strong>
                  <span>Renderer, Blender Export und Preview-Einstellungen.</span>
                </div>
              </div>

              <div class="mem-section">
                <div class="mem-control-card">
                  <header>
                    <strong>Cube Size</strong>
                    <small>{{ values.cube_size }}</small>
                  </header>

                  <v-slider
                      v-model="values.cube_size"
                      :min="64"
                      :max="1024"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <label
                    class="mem-toggle-card"
                    :class="{ active: values.rotate_preview }"
                >
                  <span class="mem-toggle-icon">
                    <v-icon>mdi-axis-z-rotate-clockwise</v-icon>
                  </span>

                  <span class="mem-toggle-text">
                    <strong>Idle Rotation</strong>
                    <small>Der Cube rotiert sanft in der Preview.</small>
                  </span>

                  <v-switch
                      v-model="values.rotate_preview"
                      hide-details
                  />
                </label>

                <div class="mem-select-card">
                  <strong>Blend Mode</strong>

                  <v-select
                      v-model="values.blend_mode"
                      :items="['OPAQUE', 'BLEND', 'HASHED', 'CLIP']"
                      density="compact"
                      hide-details
                  />
                </div>

                <div class="mem-select-card">
                  <strong>Shadow Method</strong>

                  <v-select
                      v-model="values.shadow_method"
                      :items="['NONE', 'OPAQUE', 'HASHED', 'CLIP']"
                      density="compact"
                      hide-details
                  />
                </div>

                <label
                    class="mem-toggle-card"
                    :class="{ active: values.use_nodes }"
                >
                  <span class="mem-toggle-icon">
                    <v-icon>mdi-nodejs</v-icon>
                  </span>

                  <span class="mem-toggle-text">
                    <strong>Use Blender Nodes</strong>
                    <small>Exportiert das Material als Node-Material.</small>
                  </span>

                  <v-switch
                      v-model="values.use_nodes"
                      hide-details
                  />
                </label>
              </div>
            </template>
          </div>
        </section>
      </div>
    </template>

    <template #action>
      <div class="mem-actions">
        <v-btn
            variant="text"
            class="mem-cancel"
            @click="emitEvent(config.emit, false)"
        >
          Abbrechen
        </v-btn>

        <v-spacer />

        <span class="mem-action-state">
          {{ values.shader_graph.nodes.length }} Nodes · {{ values.shader_graph.edges.length }} Edges
        </span>

        <v-btn
            class="mem-apply"
            :loading="loading"
            :disabled="!selectedSourceLayer && !isEditingMaterialLayer"
            @click="submit"
        >
          <v-icon size="18" class="mr-1">
            {{ isEditingMaterialLayer ? "mdi-content-save" : "mdi-cube-send" }}
          </v-icon>

          {{ isEditingMaterialLayer ? "Material aktualisieren" : "Layer erstellen" }}
        </v-btn>
      </div>
    </template>
  </Dialog>
</template>

<script>
import { defineComponent } from "vue";
import Dialog from "@/components/Dialog/Dialog.vue";
import Layer3D from "@/components/Layer/Layer3D/Layer3D";
import {materialEditorModel, materialEditorProps} from "@/view/models/page/material/model";

export default defineComponent({
  name: "MaterialEditor",
  components: {
    Dialog,
    Layer3D
  },
  props: materialEditorProps,
  setup(props, { emit }) {
    return {
      ...materialEditorModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Material";
</style>
