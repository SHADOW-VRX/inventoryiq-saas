# InventoryIQ SaaS — Multi-tenant Inventory Management Platform

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-14+-green)
![License](https://img.shields.io/badge/license-MIT-orange)

**InventoryIQ** is a production-ready, multi-tenant SaaS inventory management platform built specifically for clothing shops and retail businesses. It provides real-time barcode scanning, product management, stock tracking, activity logging, and subscription-based pricing — all in a beautiful, responsive dashboard.

## 🚀 Live Demo

- **Demo Shop Owner:** `owner@demo.com` / `Demo@123`
- **Super Admin:** `admin@inventoryiq.com` / `Admin@123`

## ✨ Features

### Core Features
- **🔐 Multi-tenant Architecture** — Each shop has isolated data, products, and settings
- **📱 Barcode Scanner** — Scan product barcodes using your phone's camera (powered by html5-qrcode)
- **📊 Real-time Dashboard** — Live inventory metrics, stock levels, and sales analytics
- **🏷️ Product Management** — Full CRUD operations with images, categories, sizes, and barcodes
- **📦 Stock Tracking** — Real-time inventory updates with low stock and out-of-stock alerts
- **📜 Activity Logging** — Complete audit trail of all actions (sales, product changes, logins)
- **💳 Subscription Plans** — Starter (free), Pro ($29/mo), Business ($79/mo) with plan-based limits
- **👑 Super Admin Panel** — Manage all shops, users, and subscriptions from one place
- **⚙️ Shop Settings** — Customize shop name, address, currency, and logo
- **👤 Account Management** — Update profile information and password

### Technical Features
- **Zero Dependencies** — Built with pure Node.js and vanilla JavaScript (no frameworks!)
- **File-based Storage** — JSON files for data persistence (easy to migrate to PostgreSQL)
- **Session-based Auth** — Secure HttpOnly cookies with 7-day expiration
- **RESTful API** — Clean, consistent API endpoints for all operations
- **Responsive Design** — Works perfectly on desktop, tablet, and mobile devices
- **Dark/Light Theme** — Modern gradient-based design with excellent UX

## 📋 Table of Contents

- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Database Schema](#database-schema)
- [Subscription Plans](#subscription-plans)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js (v14+)
- **Core Modules:** `http`, `fs`, `crypto`, `path`
- **Authentication:** Session-based with SHA-256 password hashing
- **Data Storage:** JSON files (extensible to PostgreSQL)

### Frontend
- **Pure Vanilla JavaScript** — No frameworks, no build step
- **CSS3** — Custom properties, flexbox, grid, animations
- **HTML5** — Semantic markup, responsive design
- **External Libraries:**
  - Font Awesome 6.5.0 (icons)
  - Google Fonts (Inter font family)
  - html5-qrcode 2.3.8 (barcode scanning)

## 📦 Installation

### Prerequisites
- Node.js 14 or higher
- npm (comes with Node.js)

### Local Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/inventoryiq-saas.git
cd inventoryiq-saas