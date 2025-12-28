# Pricebook

## Purpose
The Pricebook page manages the catalog of services, products, and line items used in estimates and invoices. Supports categories, pricing tiers, and markup rules.

## UI Behavior

### Layout Structure
1. **Header**:
   - Title with item count
   - New Item button
   - Import/Export actions

2. **Sidebar (Categories)**:
   - Category tree view
   - Add/edit/delete categories
   - Drag to reorder

3. **Main Content (Items)**:
   - Search/filter bar
   - Table or grid view
   - Columns: Name, SKU, Category, Unit Price, Unit

4. **Item Detail Modal**:
   - Name, description, SKU
   - Category selection
   - Pricing (base price, cost, markup)
   - Unit type (each, hour, sqft, etc.)
   - Tax settings

### Interactions
- **Category Click**: Filter items by category
- **New Item**: Open creation modal
- **Edit Item**: Inline or modal editing
- **Bulk Actions**: Archive, update prices

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pricebook` | GET | List all items |
| `/api/pricebook` | POST | Create item |
| `/api/pricebook/:id` | PATCH | Update item |
| `/api/pricebook/categories` | GET | List categories |

## Backend/API Interactions
- Pricing calculations include markup rules
- Items linked to estimates/invoices
- Bulk price updates available

## Automation (Neo8) Involvement
- **Price Updates**: Can trigger notification workflows
- **Low Stock Alerts**: For inventory items

## Category Structure
Categories are hierarchical:
```
Services
├── Installation
├── Repair
└── Maintenance

Products
├── Equipment
├── Materials
└── Accessories
```

## Design Tokens
- Category sidebar: `bg-glass-surface`
- Item cards: `bg-background border-border`
- Selected category: `bg-primary/10`

## Test IDs
- `button-new-item`: Create item
- `category-item-{id}`: Category tree items
- `pricebook-item-{id}`: Item cards/rows
- `input-search-pricebook`: Search
- `select-category-filter`: Category filter
