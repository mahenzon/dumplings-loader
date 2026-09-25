<!-- Compile-only smoke test for the Vue declarations (npm run lint:types, via vue-tsc). Never executed. -->
<script setup lang="ts">
import { ref } from 'vue';
import { DumplingsLoader } from 'dumplings-loader/vue';

const count = ref(5);
const paused = ref(false);
</script>

<template>
  <DumplingsLoader
    appearance="realistic"
    :count="count"
    label-position="bottom"
    :orbit-speed="0.5"
    randomness
    :paused="paused"
    class="spinner"
    style="width: 200px"
  />
  <dumplings-loader
    appearance="cartoon"
    :count="3"
    label-position="none"
    spin-axis="radial"
    :randomness="0.5"
  />
</template>
