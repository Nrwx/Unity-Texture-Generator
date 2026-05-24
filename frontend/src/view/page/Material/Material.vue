<template>
  <Dialog
      :state="state"
      :loading="loading"
      :theme="theme"
      :data="config"
      @update:component-event="emitEvent"
  >
    <template #header>
      <HeaderStatusChip :config="ui.material.header"/>
    </template>

    <template #content>
      <div class="mem-content" :class="{ 'workspace-full': isFullWorkspaceTab }">
        <section v-if="!isFullWorkspaceTab" class="mem-preview">

          <HeaderStatusMetric :config="ui.material.preview.header" @click="requestPreviewNow"/>

          <div class="mem-stage">
            <Preview :config="ui.material.preview.layer3D"/>
          </div>

          <div class="mem-canvas-controls">
            <header>
              <div>
                <strong>Canvas Controls</strong>
                <span>Preview-Hilfen für Orbit, Mesh und Topologie.</span>
              </div>

              <v-icon size="18">mdi-cube-scan</v-icon>
            </header>

            <div class="mem-canvas-control-grid">
              <button
                  type="button"
                  class="mem-canvas-control"
                  :class="{ active: values.rotate_preview }"
                  @click="setPreviewSetting('rotate_preview', !values.rotate_preview)"
              >
                <span class="mem-canvas-control-icon">
                  <v-icon size="18">mdi-orbit</v-icon>
                </span>

                <span class="mem-canvas-control-text">
                  <strong>World Orbit</strong>
                  <small>{{ values.rotate_preview ? 'Aktiv' : 'Aus' }}</small>
                </span>
              </button>

              <button
                  type="button"
                  class="mem-canvas-control"
                  :class="{ active: values.wireframe_preview }"
                  @click="setPreviewSetting('wireframe_preview', !values.wireframe_preview)"
              >
                <span class="mem-canvas-control-icon">
                  <v-icon size="18">mdi-vector-polyline</v-icon>
                </span>

                <span class="mem-canvas-control-text">
                  <strong>Wireframe</strong>
                  <small>{{ values.wireframe_preview ? 'Mesh Linien sichtbar' : 'Solid Render' }}</small>
                </span>
              </button>

              <button
                  type="button"
                  class="mem-canvas-control"
                  :class="{ active: values.faces_preview }"
                  @click="setPreviewSetting('faces_preview', !values.faces_preview)"
              >
                <span class="mem-canvas-control-icon">
                  <v-icon size="18">mdi-grid-large</v-icon>
                </span>

                <span class="mem-canvas-control-text">
                  <strong>Faces</strong>
                  <small>{{ values.faces_preview ? 'Flächen markiert' : 'Nicht markiert' }}</small>
                </span>
              </button>

              <button
                  type="button"
                  class="mem-canvas-control"
                  :class="{ active: values.vertices_preview }"
                  @click="setPreviewSetting('vertices_preview', !values.vertices_preview)"
              >
                <span class="mem-canvas-control-icon">
                  <v-icon size="18">mdi-vector-point</v-icon>
                </span>

                          <span class="mem-canvas-control-text">
                  <strong>Vertices</strong>
                  <small>{{ values.vertices_preview ? 'Punkte sichtbar' : 'Ausgeblendet' }}</small>
                </span>
              </button>
            </div>
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
            <Surface
                v-if="ui.activeTab === 'surface'"
                v-model:name="values.name"
                v-model:surface="values.surface"
                v-model:bitmap-maps="values.bitmap_maps"
                :texture-layers="textureLayers"
                @assign-texture-slot="assignTextureSlotFromSurface"
                @clear-texture-slot="clearTextureSlotFromSurface"
            />

            <!-- GEOMETRY -->
            <Geometry
                v-else-if="ui.activeTab === 'geometry'"
                v-model:geometry="values.geometry"
                @change="handleGeometryChange"
            />

            <!-- PHYSICS -->
            <Physics
                v-else-if="ui.activeTab === 'physics'"
                v-model:physics="values.physics"
                @change="requestPreviewDebounced"
            />

            <!-- LIGHT -->
            <Light
                v-else-if="ui.activeTab === 'light'"
                v-model:light="values.light"
                @change="requestPreviewDebounced"
            />

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
                    <template v-if="showUvModeSwitch">
                      <button
                          v-for="option in uvEditorModeOptions"
                          :key="option.key"
                          type="button"
                          class="mem-ghost-btn"
                          :class="{ active: values.uv.view_mode === option.key }"
                          @click="setUvEditorMode(option.key)"
                      >
                        {{ option.label }}
                      </button>
                    </template>

                    <button
                        v-if="hasUvCubemapNode && values.uv.view_mode !== 'unwrap'"
                        type="button"
                        class="mem-ghost-btn"
                        :class="{ active: values.uv.view_mode === 'face' }"
                        @click="values.uv.mode = 'cubemap'; values.uv.view_mode = 'face'; drawUvCanvas()"
                    >
                      Face View
                    </button>

                    <button
                        v-if="hasUvCubemapNode && values.uv.view_mode !== 'unwrap'"
                        type="button"
                        class="mem-ghost-btn"
                        :class="{ active: values.uv.view_mode === 'cubemap' }"
                        @click="setUvEditorMode('cubemap')"
                    >
                      CubeMap View
                    </button>

                    <button
                        v-if="hasUvCubemapNode && values.uv.view_mode !== 'unwrap'"
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
                          @mousedown.stop="startUvCanvasPointer"
                      />

                      <div class="mem-uv-canvas-hud">
                        {{ Math.round(uvViewport.zoom * 100) }}%
                      </div>

                      <div class="mem-uv-canvas-hud mem-uv-face-hud">
                        {{ values.uv.view_mode === 'unwrap' ? 'UNWRAP' : values.uv.view_mode === 'cubemap' ? 'CUBEMAP' : values.uv.active_face }}
                      </div>
                    </div>
                  </section>

                  <!-- RIGHT: CUBEMAP + INSPECTOR -->
                  <section
                      v-if="values.uv.view_mode !== 'unwrap'"
                      class="mem-uv-side-column"
                  >
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
                              :items="textureChannelOptions"
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

                  <section
                      v-else
                      class="mem-uv-side-column"
                  >
                    <section class="mem-uv-card mem-uv-cubemap-card">
                      <header class="mem-uv-card-head">
                        <div>
                          <strong>Islands</strong>
                          <span>Dynamische Auswahl aus dem aktuellen Unwrap.</span>
                        </div>
                      </header>

                      <div class="mem-uv-island-list">
                        <button
                            v-for="item in uvIslandLayout"
                            :key="item.id"
                            type="button"
                            class="mem-uv-island-item"
                            :class="{
                              active: item.active,
                              selected: item.selected,
                              mapped: item.mapped
                            }"
                            @click="selectUvIsland(item.id, $event)"
                        >
                          <strong>{{ item.label }}</strong>
                          <small>{{ item.detail }}</small>
                        </button>
                      </div>
                    </section>

                    <section class="mem-uv-card mem-uv-inspector-card">
                      <header class="mem-uv-card-head">
                        <div>
                          <strong>Unwrap Inspector</strong>
                          <span>{{ values.uv.islands.length }} islands · {{ values.uv.selected_vertex_ids.length }} vertices</span>
                        </div>
                      </header>

                      <div class="mem-uv-metrics">
                        <div>
                          <span>ISLANDS</span>
                          <strong>{{ values.uv.islands.length }}</strong>
                        </div>

                        <div>
                          <span>VERTICES</span>
                          <strong>{{ values.uv.vertices.length }}</strong>
                        </div>

                        <div>
                          <span>EDGES</span>
                          <strong>{{ values.uv.edges.length }}</strong>
                        </div>

                        <div>
                          <span>TRIS</span>
                          <strong>{{ values.uv.triangles.length }}</strong>
                        </div>
                      </div>

                      <template v-if="activeUvIsland">
                        <div class="mem-uv-control-grid">
                          <div
                              v-for="key in ['bitmap_translate_x', 'bitmap_translate_y', 'bitmap_scale_x', 'bitmap_scale_y', 'bitmap_rotate']"
                              :key="key"
                              class="mem-control-card"
                          >
                            <header>
                              <strong>{{ key.replace('bitmap_', '') }}</strong>
                              <small>
                                {{
                                  key === 'bitmap_translate_x'
                                      ? unwrapReferenceMetrics.translateX
                                      : key === 'bitmap_translate_y'
                                          ? unwrapReferenceMetrics.translateY
                                          : key === 'bitmap_scale_x'
                                              ? unwrapReferenceMetrics.scaleX
                                              : key === 'bitmap_scale_y'
                                                  ? unwrapReferenceMetrics.scaleY
                                                  : unwrapReferenceMetrics.rotate
                                }}
                              </small>
                            </header>

                            <v-slider
                                v-model="activeUvIsland[key]"
                                :min="key === 'bitmap_rotate' ? -360 : key.includes('scale') ? 0.01 : -2"
                                :max="key === 'bitmap_rotate' ? 360 : key.includes('scale') ? 10 : 2"
                                :step="key === 'bitmap_rotate' ? 1 : 0.001"
                                thumb-label
                                hide-details
                                @update:model-value="syncUnwrapReferenceMap"
                            />
                          </div>
                        </div>
                      </template>
                    </section>
                  </section>
                </div>

                <!-- BOTTOM: LAYERS + REFERENCE -->
                <section class="mem-uv-card mem-uv-assets-card">
                  <header class="mem-uv-card-head">
                    <div>
                      <strong>Face Bitmap Assignment</strong>
                      <span>
            Bitmap wird der aktiven UV-Auswahl zugewiesen.
            Aktuell: {{ values.uv.view_mode === 'unwrap' ? (values.uv.selected_island_ids.length ? values.uv.selected_island_ids.length + ' islands' : 'alle islands') : selectedUvFaces.join(', ') }}
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
                  <div
                      v-for="group in nodeTypeGroups"
                      :key="group.key"
                      class="mem-node-action-group"
                      :class="{ open: ui.activeNodeCategory === group.key }"
                  >
                    <button
                        type="button"
                        class="mem-node-category-btn"
                        @click="closeNodeContextMenu(); ui.activeNodeCategory = ui.activeNodeCategory === group.key ? '' : group.key"
                    >
                      <strong>{{ group.label }}</strong>
                      <v-icon size="14">
                        {{ ui.activeNodeCategory === group.key ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                      </v-icon>
                    </button>

                    <div
                        v-if="ui.activeNodeCategory === group.key"
                        class="mem-node-category-menu"
                    >
                      <button
                          v-for="nodeType in group.items"
                          :key="`${nodeType.group}-${nodeType.label}-${nodeType.type}`"
                          type="button"
                          class="mem-node-menu-item"
                          @click="addShaderNode(nodeType); ui.activeNodeCategory = ''"
                      >
                        <v-icon size="14">{{ nodeType.icon }}</v-icon>
                        <span>{{ nodeType.label }}</span>
                      </button>
                    </div>
                  </div>
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
                    @click="closeNodeContextMenu"
                    @contextmenu.prevent="openNodeContextMenu"
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
                        :class="[
                          node.type,
                          {
                            active: activeShaderNodeId === node.id,
                            locked: node.locked,
                            mini: isMiniShaderNode(node)
                          }
                        ]"
                        :style="{
          left: `${node.position?.x || 0}px`,
          top: `${node.position?.y || 0}px`
        }"
                        @mousedown.stop="startMoveNode($event, node)"
                        @click="activeShaderNodeId = node.id"
                    >
                      <header>
                        <v-icon size="18">
                          {{ getShaderNodeIcon(node) }}
                        </v-icon>

                        <span class="mem-node-title">
                          <strong>{{ getNodeDisplayTitle(node) }}</strong>
                        </span>

                        <i class="mem-node-category-chip">
                          {{ getNodeCategoryChip(node) || getNodeBadge(node) }}
                        </i>

                        <button
                            type="button"
                            class="mem-node-collapse"
                            :title="isMiniShaderNode(node) ? 'Node ausklappen' : 'Node einklappen'"
                            @mousedown.stop
                            @click.stop="toggleShaderNodeCollapsed(node)"
                        >
                          <v-icon size="13">
                            {{ isMiniShaderNode(node) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                          </v-icon>
                        </button>

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
              v-for="(_socket, socketName) in node.inputs"
              :key="`input-${socketName}`"
              class="mem-node-socket input"
              :class="getNodeSocketVisualType(node.id, socketName, 'input')"
              data-socket
              :data-node-id="node.id"
              :data-socket-name="socketName"
              data-socket-direction="input"
              @mousedown.stop="startConnection($event, node, socketName, 'input')"
              @mouseup.stop="completeConnection($event, node, socketName, 'input')"
          >
            <i />
            {{ getNodeSocketLabel(node.id, socketName, 'input') }}
          </span>
                        </div>

                        <div class="mem-node-socket-col right">
          <span
              v-for="(_socket, socketName) in node.outputs"
              :key="`output-${socketName}`"
              class="mem-node-socket output"
              :class="getNodeSocketVisualType(node.id, socketName, 'output')"
              data-socket
              :data-node-id="node.id"
              :data-socket-name="socketName"
              data-socket-direction="output"
              @mousedown.stop="startConnection($event, node, socketName, 'output')"
              @mouseup.stop="completeConnection($event, node, socketName, 'output')"
          >
            {{ getNodeSocketLabel(node.id, socketName, 'output') }}
            <i />
          </span>
                        </div>
                      </div>

                      <div class="mem-node-value-strip">
                        <span>{{ getNodeValueSummary(node) }}</span>
                      </div>

                      <div
                          v-if="getNodeInlineFieldItems(node).length"
                          class="mem-node-inline-fields"
                          @mousedown.stop
                      >
                        <template
                            v-for="field in getNodeInlineFieldItems(node)"
                            :key="`${node.id}-${field.key}`"
                        >
                          <label class="mem-node-inline-field">
                            <span>{{ field.label }}</span>

                            <select
                                v-if="getShaderNodeFieldOptions(node, field.key).length"
                                :value="normalizeNodeSettings(node)[field.key] || getShaderNodeFieldOptions(node, field.key)[0]"
                                @change="updateNodeSetting(node, field.key, $event.target.value)"
                            >
                              <option
                                  v-for="option in getShaderNodeFieldOptions(node, field.key)"
                                  :key="option"
                                  :value="option"
                              >
                                {{ option }}
                              </option>
                            </select>

                            <input
                                v-else-if="['clamp', 'normalize'].includes(field.key)"
                                type="checkbox"
                                :checked="normalizeNodeSettings(node)[field.key] === true"
                                @change="updateNodeSetting(node, field.key, $event.target.checked)"
                            />

                            <input
                                v-else-if="['color', 'bitmap', 'curve', 'color_mode', 'color_interpolation'].includes(field.key)"
                                type="text"
                                :value="normalizeNodeSettings(node)[field.key] || ''"
                                @input="updateNodeSetting(node, field.key, $event.target.value)"
                            />

                            <input
                                v-else
                                type="number"
                                :value="normalizeNodeSettings(node)[field.key] ?? 0"
                                @input="updateNodeSetting(node, field.key, Number($event.target.value))"
                            />
                          </label>
                        </template>
                      </div>

                      <small class="mem-node-meta">
                        <b>{{ getNodeBadge(node) }}</b>
                        {{ getNodeConnectionSummary(node) }}
                      </small>
                    </div>

                    <div
                        v-if="ui.nodeContextMenu.open"
                        class="mem-node-context-menu"
                        :style="{
                          left: `${ui.nodeContextMenu.x}px`,
                          top: `${ui.nodeContextMenu.y}px`
                        }"
                        @mousedown.stop
                        @click.stop
                        @wheel.stop
                    >
                      <div class="mem-node-context-tabs">
                        <button
                            v-for="group in nodeTypeGroups"
                            :key="`context-${group.key}`"
                            type="button"
                            :class="{ active: ui.nodeContextMenu.category === group.key }"
                            @click="ui.nodeContextMenu.category = group.key"
                        >
                          {{ group.label }}
                        </button>
                      </div>

                      <div class="mem-node-context-list">
                        <button
                            v-for="nodeType in (nodeTypeGroups.find(group => group.key === ui.nodeContextMenu.category)?.items || [])"
                            :key="`context-${nodeType.group}-${nodeType.label}-${nodeType.type}`"
                            type="button"
                            class="mem-node-menu-item"
                            @click="addShaderNodeFromContext(nodeType)"
                        >
                          <v-icon size="14">{{ nodeType.icon }}</v-icon>
                          <span>{{ nodeType.label }}</span>
                        </button>
                      </div>
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

                    <template v-if="activeShaderNode?.settings?.node_key === 'texture.bitmap'">
                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).channel"
                          :items="textureChannelOptions"
                          label="Channel"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'channel', $event)"
                      />

                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).color_mode"
                          :items="textureColorModeOptions"
                          label="Color"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'color_mode', $event)"
                      />

                      <v-text-field
                          :model-value="normalizeNodeSettings(activeShaderNode).name"
                          label="Bitmap Name"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'name', $event)"
                      />
                    </template>

                    <template v-if="activeShaderNode?.settings?.node_key === 'texture.multitexture'">
                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).channel"
                          :items="textureChannelOptions"
                          label="Mode"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'channel', $event)"
                      />

                      <v-select
                          :model-value="normalizeNodeSettings(activeShaderNode).color_mode"
                          :items="textureColorModeOptions"
                          label="Color"
                          density="compact"
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'color_mode', $event)"
                      />

                      <div
                          v-for="(group, groupIndex) in normalizeNodeSettings(activeShaderNode).texture_groups || []"
                          :key="`${group.slot || group.url}-${groupIndex}`"
                          class="mem-control-card"
                      >
                        <header>
                          <strong>{{ group.name || group.slot || `Texture ${groupIndex + 1}` }}</strong>
                          <small>{{ group.faces?.join(', ') }}</small>
                        </header>

                        <v-select
                            :model-value="group.channel || normalizeNodeSettings(activeShaderNode).channel"
                            :items="textureChannelOptions"
                            label="Image"
                            density="compact"
                            hide-details
                            @update:model-value="updateNodeTextureGroupSetting(activeShaderNode, groupIndex, 'channel', $event)"
                        />

                        <v-select
                            :model-value="group.color_mode || normalizeNodeSettings(activeShaderNode).color_mode"
                            :items="textureColorModeOptions"
                            label="Color"
                            density="compact"
                            hide-details
                            @update:model-value="updateNodeTextureGroupSetting(activeShaderNode, groupIndex, 'color_mode', $event)"
                        />
                      </div>
                    </template>

                    <template v-if="activeShaderNode?.settings?.node_key === 'uv.map' && !getShaderNodeFieldItems(activeShaderNode).length">
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

                    <div
                        v-if="getShaderNodeFieldItems(activeShaderNode).length"
                        class="mem-control-card"
                    >
                      <header>
                        <strong>Input Fields</strong>
                        <small>{{ normalizeNodeSettings(activeShaderNode).node_name || activeShaderNode.label }}</small>
                      </header>

                      <template
                          v-for="field in getShaderNodeFieldItems(activeShaderNode)"
                          :key="field.key"
                      >
                        <v-select
                            v-if="getShaderNodeFieldOptions(activeShaderNode, field.key).length"
                            :model-value="normalizeNodeSettings(activeShaderNode)[field.key] || 'Float'"
                            :items="getShaderNodeFieldOptions(activeShaderNode, field.key)"
                            :label="field.label"
                            density="compact"
                            hide-details
                            @update:model-value="updateNodeSetting(activeShaderNode, field.key, $event)"
                        />

                        <v-switch
                            v-else-if="['clamp', 'normalize'].includes(field.key)"
                            :model-value="normalizeNodeSettings(activeShaderNode)[field.key] === true"
                            :label="field.label"
                            hide-details
                            @update:model-value="updateNodeSetting(activeShaderNode, field.key, $event)"
                        />

                        <v-text-field
                            v-else-if="['color', 'bitmap', 'curve', 'color_mode', 'color_interpolation'].includes(field.key)"
                            :model-value="normalizeNodeSettings(activeShaderNode)[field.key] || ''"
                            :label="field.label"
                            density="compact"
                            hide-details
                            @update:model-value="updateNodeSetting(activeShaderNode, field.key, $event)"
                        />

                        <v-text-field
                            v-else
                            :model-value="normalizeNodeSettings(activeShaderNode)[field.key] ?? 0"
                            :label="field.label"
                            type="number"
                            density="compact"
                            hide-details
                            @update:model-value="updateNodeSetting(activeShaderNode, field.key, Number($event))"
                        />
                      </template>
                    </div>

                    <div
                        v-if="false"
                        class="mem-control-card"
                    >
                      <header>
                        <strong>Strength</strong>
                        <small>{{ normalizeNodeSettings(activeShaderNode).strength }}</small>
                      </header>

                      <v-slider
                          :model-value="normalizeNodeSettings(activeShaderNode).strength"
                          :min="-2"
                          :max="2"
                          :step="0.01"
                          thumb-label
                          hide-details
                          @update:model-value="updateNodeSetting(activeShaderNode, 'strength', $event)"
                      />
                    </div>

                    <div
                        v-if="false"
                        class="mem-control-card"
                    >
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
                        v-if="false"
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
            <Export
                v-else-if="ui.activeTab === 'export'"
                :preview-layer="previewLayer"
                :is-editing-material-layer="isEditingMaterialLayer"
                @request-export="requestExport"
            />

            <!-- SETTINGS -->
            <Settings
                v-else-if="ui.activeTab === 'settings'"
                v-model:settings="materialSettings"
                @change="requestPreviewDebounced"
            />
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
import HeaderStatusChip from "@/view/components/Header/Header";
import HeaderStatusMetric from "@/view/components/Header/Metric/Metric";
import Preview from "@/view/page/Material/Preview/Preview";
import {materialEditorModel, materialEditorProps} from "@/view/models/page/material/model";
import Surface from "@/view/page/Material/Surface/Surface";
import Geometry from "@/view/page/Material/Geometry/Geometry";
import Light from "@/view/page/Material/Light/Light";
import Export from "@/view/page/Material/Export/Export";
import Settings from "@/view/page/Material/Settings/Settings";
import Physics from "@/view/page/Material/Physics/Physics";

export default defineComponent({
  name: "MaterialEditor",
  components: {
    Dialog,
    HeaderStatusChip,
    HeaderStatusMetric,
    Preview,
    Surface,
    Geometry,
    Physics,
    Light,
    Export,
    Settings
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
@use "./_Material";
</style>
