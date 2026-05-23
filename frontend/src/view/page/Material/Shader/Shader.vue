<!-- SHADER -->
<template>
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
        @pointerdown="startCanvasPan"
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
            @pointerdown.stop="startMoveNode($event, node)"
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
                @pointerdown.stop
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
                @pointerdown.stop
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
              @pointerdown.stop="startConnection($event, node, socketName, 'input')"
              @pointerup.stop="completeConnection($event, node, socketName, 'input')"
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
              @pointerdown.stop="startConnection($event, node, socketName, 'output')"
              @pointerup.stop="completeConnection($event, node, socketName, 'output')"
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
              @pointerdown.stop
          >
            <template
                v-for="field in getNodeInlineFieldItems(node)"
                :key="`${node.id}-${field.key}`"
            >
              <label class="mem-node-inline-field">
                <span>{{ field.label }}</span>

                <select
                    v-if="field.type === 'select'"
                    :value="normalizeNodeSettings(node)[field.key] ?? field.items?.[0] ?? ''"
                    @change="updateNodeSetting(node, field.key, $event.target.value)"
                >
                  <option
                      v-for="option in field.items"
                      :key="option"
                      :value="option"
                  >
                    {{ option }}
                  </option>
                </select>

                <input
                    v-else-if="field.type === 'boolean'"
                    type="checkbox"
                    :checked="normalizeNodeSettings(node)[field.key] === true"
                    @change="updateNodeSetting(node, field.key, $event.target.checked)"
                />

                <input
                    v-else-if="field.type === 'number'"
                    type="number"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step ?? 0.001"
                    :value="normalizeNodeSettings(node)[field.key] ?? 0"
                    @input="updateNodeSetting(node, field.key, Number($event.target.value))"
                />

                <input
                    v-else
                    type="text"
                    :value="normalizeNodeSettings(node)[field.key] ?? ''"
                    @input="updateNodeSetting(node, field.key, $event.target.value)"
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
            @pointerdown.stop
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
                v-if="field.type === 'select'"
                :model-value="normalizeNodeSettings(activeShaderNode)[field.key] ?? field.items?.[0] ?? ''"
                :items="field.items"
                :label="field.label"
                density="compact"
                hide-details
                @update:model-value="updateNodeSetting(activeShaderNode, field.key, $event)"
            />

            <v-switch
                v-else-if="field.type === 'boolean'"
                :model-value="normalizeNodeSettings(activeShaderNode)[field.key] === true"
                :label="field.label"
                hide-details
                @update:model-value="updateNodeSetting(activeShaderNode, field.key, $event === true)"
            />

            <v-text-field
                v-else-if="field.type === 'number'"
                :model-value="normalizeNodeSettings(activeShaderNode)[field.key] ?? 0"
                :label="field.label"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step ?? 0.001"
                density="compact"
                hide-details
                @update:model-value="updateNodeSetting(activeShaderNode, field.key, Number($event))"
            />

            <v-text-field
                v-else
                :model-value="normalizeNodeSettings(activeShaderNode)[field.key] ?? ''"
                :label="field.label"
                density="compact"
                hide-details
                @update:model-value="updateNodeSetting(activeShaderNode, field.key, $event)"
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

<script>


import {shaderModel, shaderModelProps} from "@/view/models/page/material/shader/model";

export default {
  name: "ShaderEditor",
  props: shaderModelProps,
  setup(props, { emit }) {
    const model = shaderModel(props, emit)
    return {
      ...model
    };
  },
};
</script>

<style scoped lang="scss">
@use "./_Shader";
</style>