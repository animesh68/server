const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// GET /api/items/search?name=xyz  ← MUST be before /:id
router.get('/search', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const items = await Item.find({
      $or: [
        { itemName: { $regex: name, $options: 'i' } },
        { type: { $regex: name, $options: 'i' } },
        { location: { $regex: name, $options: 'i' } }
      ]
    }).populate('postedBy', 'name email').sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// GET /api/items → Get all items
router.get('/', async (req, res) => {
  try {
    const items = await Item.find()
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// GET /api/items/:id → Get item by ID
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('postedBy', 'name email');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// POST /api/items → Add item
router.post('/', async (req, res) => {
  try {
    const { itemName, description, type, location, date, contactInfo } = req.body;

    if (!itemName || !type) {
      return res.status(400).json({ message: 'Item name and type are required' });
    }

    if (!['Lost', 'Found'].includes(type)) {
      return res.status(400).json({ message: 'Type must be Lost or Found' });
    }

    const item = await Item.create({
      itemName,
      description,
      type,
      location,
      date: date || Date.now(),
      contactInfo,
      postedBy: req.user._id
    });

    const populated = await item.populate('postedBy', 'name email');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// PUT /api/items/:id → Update item
router.put('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check ownership
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    const { itemName, description, type, location, date, contactInfo } = req.body;

    if (type && !['Lost', 'Found'].includes(type)) {
      return res.status(400).json({ message: 'Type must be Lost or Found' });
    }

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      { itemName, description, type, location, date, contactInfo },
      { new: true, runValidators: true }
    ).populate('postedBy', 'name email');

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// DELETE /api/items/:id → Delete item
router.delete('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check ownership
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;
