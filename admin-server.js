const express = require('express');
const persist = require('node-persist');
const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', './views');

(async () => {
    await persist.init({ dir: './storage' });

    app.get('/', async (req, res) => {
        const keys = await persist.keys();
        const users = [];

        for (let key of keys) {
            const u = await persist.getItem(key);
            users.push({ id: key, count: u.count, resetAt: u.resetAt, paid: u.paid });
        }

        res.render('dashboard', { users });
    });

    app.listen(port, () => console.log(`📊 Admin dashboard: http://localhost:${port}`));
})();
