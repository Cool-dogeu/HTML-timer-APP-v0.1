<template>
  <div class="mled-container">
    <HdmiStickyControls />
    <HdmiTextModule />
    <HdmiCoursewalksModule />
    <HdmiCountdownModule />
    <HdmiLinkModule />
  </div>
</template>

<script setup>
import HdmiStickyControls from '@/components/hdmi/HdmiStickyControls.vue'
import HdmiTextModule from '@/components/hdmi/HdmiTextModule.vue'
import HdmiCoursewalksModule from '@/components/hdmi/HdmiCoursewalksModule.vue'
import HdmiCountdownModule from '@/components/hdmi/HdmiCountdownModule.vue'
import HdmiLinkModule from '@/components/hdmi/HdmiLinkModule.vue'
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
