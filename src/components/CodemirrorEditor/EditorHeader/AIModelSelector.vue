<script setup lang="ts">
import { useAIStore } from '@/stores'
import { computed } from 'vue'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../ui/select'

const props = withDefaults(defineProps<{
  modelId: string
  label?: string
  placeholder?: string
}>(), {
  label: `模型`,
  placeholder: `选择模型`,
})

const emit = defineEmits<{
  (e: `update:modelId`, value: string): void
}>()

const aiStore = useAIStore()

const displayLabel = computed(() => props.modelId || props.placeholder)

function handleModelChange(value: string) {
  emit(`update:modelId`, value)
}
</script>

<template>
  <div class="grid gap-2">
    <p class="text-sm font-medium">
      {{ label }}
    </p>
    <Select :model-value="modelId" @update:model-value="handleModelChange">
      <SelectTrigger>
        <SelectValue :placeholder="displayLabel" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>可用模型</SelectLabel>
          <SelectItem
            v-for="model in aiStore.models"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name }}
          </SelectItem>
        </SelectGroup>
        <SelectGroup v-if="aiStore.customModels.length > 0">
          <SelectLabel>自定义模型</SelectLabel>
          <SelectItem
            v-for="model in aiStore.customModels"
            :key="model"
            :value="model"
          >
            {{ model }}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
</template>
