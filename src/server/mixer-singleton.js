
let mixer = null;
let mixerState = {
    master: { level: 0, levelDb: -100, mute: 0 },
    inputs: Array(24).fill(0).map(() => ({
        level: 0, levelDb: -100, mute: 0, phantom: 0, hpf: 100, gate: 0, comp: 0, eq: {}
    })),
    aux: Array(10).fill(0).map(() => ({ level: 0 }))
};

module.exports = {
    getMixer: () => mixer,
    setMixer: (m) => { mixer = m; },
    getState: () => mixerState,
    setState: (nextState) => { mixerState = nextState; },
    updateMasterState: (patch) => { mixerState.master = Object.assign({}, mixerState.master, patch); },
    updateChannelState: (ch, patch) => {
        if (!mixerState.inputs[ch - 1]) return null;
        mixerState.inputs[ch - 1] = Object.assign({}, mixerState.inputs[ch - 1], patch);
        return mixerState.inputs[ch - 1];
    },
    updateAuxState: (aux, patch) => {
        if (!mixerState.aux[aux - 1]) return null;
        mixerState.aux[aux - 1] = Object.assign({}, mixerState.aux[aux - 1], patch);
        return mixerState.aux[aux - 1];
    },
    getChannelState: (ch) => mixerState.inputs[ch - 1] || null,
    getMasterState: () => mixerState.master,
    getAuxState: (aux) => mixerState.aux[aux - 1] || null
};
