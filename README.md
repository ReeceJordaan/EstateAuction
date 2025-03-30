# Estate Auction Platform

A real-time real estate auction system with live bidding, user management, and property listing capabilities.

## Project Overview

The Estate Auction Platform is a full-stack web application that enables:
- Real-time property auctions with live bidding
- User account creation and management
- Property listing and detailed viewing
- Automated auction state management
- Email notifications for auction winners

**Target Audience**: Real estate agencies, auction houses, and individual property sellers looking for an efficient online auction solution.

## Key Features

### Real-Time Bidding System
- Live updates of bids to all connected clients
- Instant notifications when outbid
- Automated bid validation against current highest bid

### Property Management
- Detailed property creation form with:
  - Location (with map integration)
  - Property specifications (bedrooms, bathrooms, etc.)
  - High-quality image uploads
  - Comprehensive descriptions

### User Management
- Secure login system
- Profile management
- Auction participation history
- Won auctions tracking

### Auction Automation
- Scheduled start/end times
- Automatic state transitions (Waiting → Ongoing → Done)
- Winner determination and notification

## Technical Implementation

### Frontend-Backend Interaction
- Socket.io for real-time bidirectional communication
- RESTful API for data operations

### Real-Time Updates
- WebSocket connections maintain persistent communication
- Server broadcasts bid updates to all connected clients
- Automated checks for auction state changes every 10 seconds

### Database Integration
- MySQL database for persistent storage
- API endpoints for all data operations
- Secure authentication using environment variables

## Tech Stack

### Frontend
- HTML5, CSS3, JavaScript, PHP
- Socket.io client
- Leaflet.js for map integration

### Backend
- Node.js
- Socket.io for real-time communication
- Nodemailer for email notifications
- MySQL database

### Development Tools
- Git for version control
- npm for package management
- Environment variables for configuration