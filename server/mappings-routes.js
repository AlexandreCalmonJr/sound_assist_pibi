function registerMappingsRoutes(app, db) {
    app.get('/api/mappings', (req, res) => {
        db.find({}, (err, docs) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(docs);
        });
    });

    app.post('/api/mappings', (req, res) => {
        db.insert(req.body, (err, newDoc) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(newDoc);
        });
    });

    app.delete('/api/mappings/:id', (req, res) => {
        db.remove({ _id: req.params.id }, {}, (err, numRemoved) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ removed: numRemoved });
        });
    });
}

module.exports = { registerMappingsRoutes };
