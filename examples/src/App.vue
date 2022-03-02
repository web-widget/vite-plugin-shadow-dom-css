<template>
  <div class="index">
    <h1>style-provider demo</h1>
    <Todolist></Todolist>
  </div>
</template>

<script>
  import Todolist from './Todolist.vue'
	export default {
    name: 'app',
    components: {
      Todolist
    }
  }
</script>

<style scoped style-provider>
  .index h1 {
    font-weight: normal;
  }
</style>
