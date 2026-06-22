// src/dataLayer/taskEvents.js
const resolveTaskId = payload => payload && typeof payload === "object" ? payload.id : payload;

export const taskEvent = (route) => ({
    /* create task and refresh list */
    "task:create": async (payload) => {
        const response = await route.api.createTask(payload);
        console.log(payload, "create")
        if (response) {
            // after creation, refresh global list
            await route.emit("task:fetch-list");
        }
    },

    /* update task and refresh list */
    "task:update": async (payload) => {
        const response = await route.api.updateTask(payload);
        console.log(payload, "update")
        if (response) {
            await route.emit("task:fetch-list");
            console.log(response)
        }
    },

    /* delete (or deactivate) */
    "task:delete": async (payload) => {
        console.log(payload, "delete")
        const response = await route.api.deleteTask(payload);
        if (response) {
            await route.emit("task:fetch-list");
        }
    },

    /* fetch list and store into route.taskStates.list */
    "task:fetch-list": async () => {
        const response = await route.api.fetchTask();
        if (response) {
            console.log(response, "fetch-list")
            route.localData.tasks.value = response;
            return true
        }
        return false
    },

    "task:fetch-meta": async (payload) => {
        const response = await route.api.fetchTask(payload);
        console.log(payload, "fetch-meta")
        if (response) {
            route.localData.tasksMeta.value = response;
            console.log(response, "fetch-meta response")
            return true
        }
        return false
    },

    /* fetch single task and store into route.taskStates.current */
    "task:fetch-one": async (payload) => {
        const taskId = resolveTaskId(payload);
        const entryIndex = route.localData.tasks.value.findIndex(x => x.id === taskId);
        console.log(payload, "fetch-one")
        if (entryIndex !== -1) {
            const response = await route.api.fetchTask({id: taskId});
            if (response) {
                console.log(response, "fetch-one response")
                route.localData.tasks.value[entryIndex] = response;
                return true
            }
            return false
        }
        return false
    },

    /* run - calls run and then refreshes list/status */
    "task:run": async (payload) => {
        const response = await route.api.runTask(payload);
        console.log(payload, "run")
        if (response) {
            await route.emit("task:fetch-list");
            await route.emit("task:fetch-one", resolveTaskId(payload));
        }
    },

    /* schedule: { id, delay } */
    "task:schedule": async (payload) => {
        console.log(payload, "schedule")
        const response = await route.api.scheduleTask(payload);
        if (response) {
            await route.emit("task:fetch-list");
            await route.emit("task:fetch-one", resolveTaskId(payload));
        }
    },

    /* stop/terminate */
    "task:stop": async (payload) => {
        console.log(payload, "stop")
        const response = await route.api.stopTask(payload);
        if (response) {
            await route.emit("task:fetch-list");
            await route.emit("task:fetch-one", resolveTaskId(payload));
        }
    },

    /* stop/terminate */
    "task:edit": async (payload) => {
        route.windowStates.taskEdit.value = payload
    }
});
