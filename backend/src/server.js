require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch (e) { res.status(503).json({ status: 'error', message: 'Database unavailable' }); }
});
app.get('/api/customers', async (_req, res) => {
  try { const r = await pool.query('SELECT id, name, email, phone FROM customers ORDER BY id DESC'); res.json(r.rows); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Could not load customers' }); }
});
app.post('/api/customers', async (req, res) => {
  const { name, email = '', phone = '' } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Customer name is required' });
  try {
    const r = await pool.query('INSERT INTO customers(name,email,phone) VALUES($1,$2,$3) RETURNING id,name,email,phone', [String(name).trim(), String(email).trim(), String(phone).trim()]);
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not create customer' }); }
});
app.get('/api/products', async (_req, res) => {
  try { const r = await pool.query('SELECT id, name, sku, price, stock FROM products ORDER BY id DESC'); res.json(r.rows); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Could not load products' }); }
});
app.post('/api/products', async (req, res) => {
  const { name, sku = '', price, stock = 0 } = req.body || {};
  const p = Number(price), s = Number(stock);
  if (!name || !Number.isFinite(p) || p < 0 || !Number.isInteger(s) || s < 0) return res.status(400).json({ error: 'Provide a name, non-negative price, and non-negative whole-number stock' });
  try {
    const r = await pool.query('INSERT INTO products(name,sku,price,stock) VALUES($1,$2,$3,$4) RETURNING id,name,sku,price,stock', [String(name).trim(), String(sku).trim(), p, s]);
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not create product' }); }
});
app.get('/api/invoices', async (_req, res) => {
  try {
    const r = await pool.query(`SELECT i.id, i.invoice_number, i.customer_id, c.name AS customer_name, i.subtotal, i.tax, i.total, i.status, i.created_at
      FROM invoices i JOIN customers c ON c.id=i.customer_id ORDER BY i.id DESC`);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load invoices' }); }
});
app.post('/api/invoices', async (req, res) => {
  const { customerId, items, taxRate = 0 } = req.body || {};
  if (!Number.isInteger(Number(customerId)) || !Array.isArray(items) || items.length === 0 || !Number.isFinite(Number(taxRate)) || Number(taxRate) < 0 || Number(taxRate) > 100) {
    return res.status(400).json({ error: 'Provide customerId, at least one item, and taxRate between 0 and 100' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customer = await client.query('SELECT id FROM customers WHERE id=$1', [Number(customerId)]);
    if (!customer.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Customer does not exist' }); }
    let subtotal = 0; const cleanItems = [];
    for (const item of items) {
      const productId = Number(item.productId), quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) throw new Error('Each item needs a valid productId and quantity of at least 1');
      const result = await client.query('SELECT id,name,price,stock FROM products WHERE id=$1 FOR UPDATE', [productId]);
      if (!result.rowCount) throw new Error(`Product ${productId} does not exist`);
      const product = result.rows[0];
      if (product.stock < quantity) throw new Error(`Not enough stock for ${product.name}`);
      const unitPrice = Number(product.price), lineTotal = Math.round(unitPrice * quantity * 100) / 100;
      subtotal += lineTotal; cleanItems.push({ productId, quantity, unitPrice, lineTotal });
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [quantity, productId]);
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const tax = Math.round(subtotal * Number(taxRate)) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const invoiceNumber = `INV-${Date.now()}`;
    const inv = await client.query('INSERT INTO invoices(invoice_number,customer_id,subtotal,tax,total,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [invoiceNumber, Number(customerId), subtotal, tax, total, 'PENDING']);
    for (const item of cleanItems) await client.query('INSERT INTO invoice_items(invoice_id,product_id,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5)', [inv.rows[0].id, item.productId, item.quantity, item.unitPrice, item.lineTotal]);
    await client.query('COMMIT'); res.status(201).json(inv.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    const clientError = /does not exist|Not enough stock|valid productId/.test(e.message);
    res.status(clientError ? 400 : 500).json({ error: clientError ? e.message : 'Could not create invoice' });
  } finally { client.release(); }
});
app.patch('/api/invoices/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!['PENDING', 'PAID', 'CANCELLED'].includes(status)) return res.status(400).json({ error: 'Status must be PENDING, PAID, or CANCELLED' });
  try { const r = await pool.query('UPDATE invoices SET status=$1 WHERE id=$2 RETURNING *', [status, Number(req.params.id)]); if (!r.rowCount) return res.status(404).json({ error: 'Invoice not found' }); res.json(r.rows[0]); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Could not update invoice' }); }
});
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Unexpected server error' }); });
const port = Number(process.env.PORT || 4000);
app.listen(port, '0.0.0.0', () => console.log(`Billing API listening on ${port}`));
