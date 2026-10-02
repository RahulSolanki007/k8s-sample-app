// Simple Express API with DB health check

const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kubernetes Node API',
      version: '1.0.0',
      description: 'Sample Node.js API with PostgreSQL and Kubernetes deployment manifests',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      schemas: {
        Item: {
          type: 'object',
          required: ['name'],
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'demo item' },
            completed: { type: 'boolean', example: false },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./app/server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * @openapi
 * /:
 *   get:
 *     summary: Welcome route
 *     responses:
 *       200:
 *         description: Welcome message
 */
app.get('/', (req, res) => {
  res.send('Hello from Kubernetes Node.js API!');
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check application and database health
 *     responses:
 *       200:
 *         description: Database is reachable
 *         content:
 *           application/json:
 *             example:
 *               status: ok
 *               dbTime: '2026-10-02T12:00:00.000Z'
 *       500:
 *         description: Database query failed
 */
const handleHealthCheck = async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'ok', dbTime: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

app.get('/health', handleHealthCheck);
app.get('/healthz', handleHealthCheck);

/**
 * @openapi
 * /items:
 *   get:
 *     summary: List all items
 *     responses:
 *       200:
 *         description: List of items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Item'
 *   post:
 *     summary: Create a new item
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Item created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Item'
 *       400:
 *         description: Invalid request
 */
app.get('/items', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM items ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/items', async (req, res) => {
  const { name, completed = false } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO items (name, completed) VALUES ($1, $2) RETURNING *',
      [name.trim(), Boolean(completed)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * @openapi
 * /items/{id}:
 *   get:
 *     summary: Get an item by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Item'
 *       404:
 *         description: Item not found
 *   put:
 *     summary: Update an item by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Item updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Item'
 *       404:
 *         description: Item not found
 *   delete:
 *     summary: Delete an item by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item deleted
 *       404:
 *         description: Item not found
 */
app.get('/items/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('SELECT * FROM items WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ status: 'error', message: 'Item not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.put('/items/:id', async (req, res) => {
  const { id } = req.params;
  const { name, completed } = req.body || {};

  if (name === undefined && completed === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'At least one field (name or completed) is required',
    });
  }

  const updates = [];
  const values = [];
  let index = 1;

  if (name !== undefined) {
    updates.push(`name = $${index}`);
    values.push(String(name).trim());
    index += 1;
  }

  if (completed !== undefined) {
    updates.push(`completed = $${index}`);
    values.push(Boolean(completed));
    index += 1;
  }

  values.push(id);

  try {
    const result = await db.query(
      `UPDATE items SET ${updates.join(', ')} WHERE id = $${index} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: 'error', message: 'Item not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.delete('/items/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ status: 'error', message: 'Item not found' });
    }

    res.json({ status: 'ok', deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
      console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
