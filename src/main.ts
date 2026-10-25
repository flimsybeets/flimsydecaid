import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './styles.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { app } from './state/app.svelte';

app.start();

export default mount(App, { target: document.getElementById('app')! });
