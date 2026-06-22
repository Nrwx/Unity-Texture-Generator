import axios from 'axios';
import {windowStates} from "@/dataLayer/state";
import {appData} from "@/dataLayer/local";

const client = axios.create({
    responseType: 'json',
});

const syncClientConfig = () => {
    client.defaults.baseURL = appData.apiBaseUrl.value;
};

const api = {
    async get(route, config = {}) {
        if (windowStates.queue.value === false) windowStates.queue.value = true;
        try {
            syncClientConfig();
            const response = await client.get(route, config);
            return response.data;
        } catch (error) {
            console.error(`GET ${route} failed:`, error.response?.data || error.message);
            throw error;
        }
    },

    async post(route, data = {}, config = {}) {
        if(windowStates.queue.value === false) windowStates.queue.value = true;
        try {
            syncClientConfig();
            const response = await client.post(route, data, config);
            return response.data;
        } catch (error) {
            console.error(`POST ${route} failed:`, error.response?.data || error.message);
            throw error;
        }
    },

    async put(route, data = {}) {
        if(windowStates.queue.value === false) windowStates.queue.value = true;
        try {
            syncClientConfig();
            const response = await client.put(route, data);
            return response.data;
        } catch (error) {
            console.error(`PUT ${route} failed:`, error.response?.data || error.message);
            throw error;
        }
    },

    async delete(route, data = {}) {
        if(windowStates.queue.value === false) windowStates.queue.value = true;
        try {
            syncClientConfig();
            const response = await client.delete(route, { data });
            return response.data;
        } catch (error) {
            console.error(`DELETE ${route} failed:`, error.response?.data || error.message);
            throw error;
        }
    },
};

export default api;
