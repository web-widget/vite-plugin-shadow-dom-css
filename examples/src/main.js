import Vue from 'vue';
import App from './App.vue';
import allStyleProvider from 'virtual:style-provider?query=~/*';

export default (props) => {
  let appWrap;
  let app;
  let allStyle;

  return {
    async bootstrap({ container }) {
      allStyle = allStyleProvider(container);
    },
    async mount(props) {
      appWrap = document.createElement('div');

      props.container.appendChild(appWrap);
      allStyle.mount();

      app = new Vue({
        el: appWrap,
        provide: {
          host: props,
        },
        render(h) {
          return h(App);
        }
      });
    },
    async unmount({ container }) {
      app.$destroy();
      allStyle.unmount();
      container.innerHTML = '';
      appWrap = app = null;
    },
  };
};
