import axios from 'axios';

const client = axios.create({
    baseURL: 'http://127.0.0.1:5000', // Basis-URL
    responseType: 'json',
});

const api = {
    async get(route, params = {}) {
        try {
            const response = await client.get(route, { params });
            return response.data;
        } catch (error) {
            console.error(`GET ${route} failed:`, error.response?.data || error.message);
            throw error;
        }
    },

    async post(route, data = {}, config = {}) {
        try {
            const response = await client.post(route, data, config);
            return response.data;
        } catch (error) {
            console.error(`POST ${route} failed:`, error.response?.data || error.message);
            throw error;
        }
    },

    async put(route, data = {}) {
        try {
            const response = await client.put(route, data);
            return response.data;
        } catch (error) {
            console.error(`PUT ${route} failed:`, error.response?.data || error.message);
            throw error;
        }
    },

    async delete(route, data = {}) {
        try {
            const response = await client.delete(route, { data });
            return response.data;
        } catch (error) {
            console.error(`DELETE ${route} failed:`, error.response?.data || error.message);
            throw error;
        }
    },
};

export default api;
