import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Gavel, Download, Upload, Settings, LogOut, User } from 'lucide-react';
import { database } from './firebase-config';
import { ref, set, onValue } from 'firebase/database';

// Color palette
const colors = {
  cream: '#f5f9f5',
  sage: '#e8f5e9',
  navy: '#1e3a8a',
  emerald: '#10b981',
  gold: '#d4af37',
  white: '#ffffff',
  text: '#000000',
  lightText: '#4a5568',
  border: '#c7e6cb'
};

// Utility function for generating unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Initial bidder data
const INITIAL_BIDDERS = [
  { name: 'Laurie', balance: 500, password: '', itemsWon: [] },
  { name: 'Miguel', balance: 500, password: '', itemsWon: [] },
  { name: 'Seth', balance: 500, password: '', itemsWon: [] },
  { name: 'Richard', balance: 500, password: '', itemsWon: [] },
  { name: 'Benjamin', balance: 500, password: '', itemsWon: [] },
  { name: 'Erik', balance: 500, password: '', itemsWon: [] },
  { name: 'Gregory', balance: 500, password: '', itemsWon: [] }
];

const AuctionApp = () => {
  // Core state - will be synced with Firebase
  const [setupComplete, setSetupComplete] = useState(false);
  const [auctioneerPassword, setAuctioneerPassword] = useState('');
  const [bidders, setBidders] = useState(INITIAL_BIDDERS);
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuctioneer, setIsAuctioneer] = useState(false);
  
  // Auction state - will be synced with Firebase
  const [currentItemIndex, setCurrentItemIndex] = useState(-1);
  const [currentBids, setCurrentBids] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [itemActive, setItemActive] = useState(false);
  const [lastBidTime, setLastBidTime] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  
  // Firebase sync - Load all data from Firebase on mount
  useEffect(() => {
    // Listen to passwords
    const passwordsRef = ref(database, 'passwords');
    const unsubPasswords = onValue(passwordsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.auctioneer) setAuctioneerPassword(data.auctioneer);
      }
    });
    
    // Listen to bidders
    const biddersRef = ref(database, 'bidders');
    const unsubBidders = onValue(biddersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBidders(data);
      }
    });
    
    // Listen to items
    const itemsRef = ref(database, 'items');
    const unsubItems = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setItems(data);
      }
    });
    
    // Listen to auction state
    const auctionRef = ref(database, 'auction');
    const unsubAuction = onValue(auctionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCurrentItemIndex(data.currentItemIndex ?? -1);
        setCurrentBids(data.currentBids || []);
        setTimeRemaining(data.timeRemaining ?? 300);
        setItemActive(data.itemActive ?? false);
        setLastBidTime(data.lastBidTime ?? null);
        setIsPaused(data.isPaused ?? false);
      }
    });
    
    // Cleanup listeners on unmount
    return () => {
      unsubPasswords();
      unsubBidders();
      unsubItems();
      unsubAuction();
    };
  }, []);
  
  // Helper function to update Firebase
  const updateFirebase = async (path, data) => {
    try {
      await set(ref(database, path), data);
    } catch (error) {
      console.error('Firebase update error:', error);
    }
  };
  
  // DON'T auto-sync bidders - only sync when explicitly saved
  // This prevents overwriting during typing
  
  // Sync items to Firebase whenever they change
  useEffect(() => {
    if (items) {
      updateFirebase('items', items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  
  // Sync auction state to Firebase
  useEffect(() => {
    const auctionState = {
      currentItemIndex,
      currentBids,
      timeRemaining,
      itemActive,
      lastBidTime,
      isPaused
    };
    updateFirebase('auction', auctionState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemIndex, currentBids, timeRemaining, itemActive, lastBidTime, isPaused]);
  
  // UI state
  const [customBidAmount, setCustomBidAmount] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [notification, setNotification] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  
  // Login state
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Refs
  const timerRef = useRef(null);
  const lastBidTimeRef = useRef(null);
  const autoAdvanceRef = useRef(null);
  
  // Get sorted items by number
  const sortedItems = [...items].sort((a, b) => a.number - b.number);
  const currentItem = currentItemIndex >= 0 ? sortedItems[currentItemIndex] : null;
  
  // End current item function
  const endCurrentItem = useCallback(() => {
    if (!currentItem || !itemActive) return;
    
    setItemActive(false);
    
    if (currentBids.length > 0) {
      const highestBid = currentBids[currentBids.length - 1];
      const winner = highestBid.bidder;
      const amount = highestBid.amount;
      
      setItems(items.map(item => 
        item.id === currentItem.id 
          ? { ...item, winner, winningBid: amount }
          : item
      ));
      
      const updatedBidders = bidders.map(b => 
        b.name === winner 
          ? { 
              ...b, 
              balance: b.balance - amount,
              itemsWon: [...(b.itemsWon || []), { ...currentItem, winningBid: amount }]
            }
          : b
      );
      setBidders(updatedBidders);
      
      // Sync to Firebase
      updateFirebase('bidders', updatedBidders);
      
      showNotification(`${currentItem.title} sold to ${winner} for $${amount}!`);
    } else {
      showNotification(`${currentItem.title} ended with no bids`);
    }
    
    // Auto-advance to next item after 10 seconds
    autoAdvanceRef.current = setTimeout(() => {
      // Find next unwon item
      const nextUnwonIndex = sortedItems.findIndex((item, idx) => !item.winner && idx > currentItemIndex);
      
      if (nextUnwonIndex >= 0) {
        setCurrentItemIndex(nextUnwonIndex);
        setCurrentBids([]);
        setTimeRemaining(300);
        setItemActive(true);
        const now = Date.now();
        setLastBidTime(now);
        lastBidTimeRef.current = now;
        setIsPaused(false);
        showNotification(`Auto-starting: ${sortedItems[nextUnwonIndex].title}`);
      } else {
        // Check from beginning if we're at the end
        const firstUnwonIndex = sortedItems.findIndex(item => !item.winner);
        if (firstUnwonIndex >= 0) {
          setCurrentItemIndex(firstUnwonIndex);
          setCurrentBids([]);
          setTimeRemaining(300);
          setItemActive(true);
          const now = Date.now();
          setLastBidTime(now);
          lastBidTimeRef.current = now;
          setIsPaused(false);
          showNotification(`Auto-starting: ${sortedItems[firstUnwonIndex].title}`);
        } else {
          showNotification('🎉 All items have been auctioned!');
        }
      }
    }, 10000); // 10 second delay
  }, [currentItem, itemActive, currentBids, items, bidders, currentItemIndex, sortedItems]);
  
  // Timer logic
  useEffect(() => {
    if (itemActive && currentItem && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const now = Date.now();
          const timeSinceLastBid = lastBidTimeRef.current 
            ? (now - lastBidTimeRef.current) / 1000 
            : Infinity;
          
          if (timeSinceLastBid >= 30) {
            endCurrentItem();
            return 0;
          }
          
          if (prev <= 1) {
            endCurrentItem();
            return 0;
          }
          
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [itemActive, currentItem, endCurrentItem, isPaused]);
  
  useEffect(() => {
    lastBidTimeRef.current = lastBidTime;
  }, [lastBidTime]);
  
  // Sync auctioneer password to Firebase
  useEffect(() => {
    if (auctioneerPassword) {
      updateFirebase('passwords/auctioneer', auctioneerPassword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctioneerPassword]);
  
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  };
  
  const handleLogin = (name, password) => {
    // Check if auctioneer trying to login without password set
    if (name === 'auctioneer' && !auctioneerPassword) {
      // Allow auctioneer to login even without setup to do initial setup
      setIsAuctioneer(true);
      setCurrentUser('auctioneer');
      showNotification('Please complete setup - set all passwords and add items');
      setShowPasswordModal(true);
      return;
    }
    
    if (name === 'auctioneer' && password === auctioneerPassword) {
      setIsAuctioneer(true);
      setCurrentUser('auctioneer');
      showNotification('Logged in as Auctioneer');
      return;
    }
    
    const bidder = bidders.find(b => b.name === name && b.password === password);
    
    if (bidder) {
      setCurrentUser(name);
      setIsAuctioneer(false);
      showNotification(`Welcome, ${name}!`);
    } else {
      showNotification('Invalid credentials');
    }
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuctioneer(false);
  };
  
  const addItem = async (item) => {
    const newItems = [...items, { ...item, id: generateId(), winner: null, winningBid: null }];
    setItems(newItems);
    await updateFirebase('items', newItems);
    showNotification('Item added and synced');
  };
  
  const updateItem = async (id, updates) => {
    const newItems = items.map(item => item.id === id ? { ...item, ...updates } : item);
    setItems(newItems);
    await updateFirebase('items', newItems);
    setEditingItem(null);
    showNotification('Item updated and synced');
  };
  
  const deleteItem = async (id) => {
    if (window.confirm('Delete this item?')) {
      const newItems = items.filter(item => item.id !== id);
      setItems(newItems);
      await updateFirebase('items', newItems);
      showNotification('Item deleted and synced');
    }
  };
  
  const startItem = (index) => {
    // Cancel any pending auto-advance
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    
    if (itemActive) {
      showNotification('End current item first');
      return;
    }
    const now = Date.now();
    setCurrentItemIndex(index);
    setCurrentBids([]);
    setTimeRemaining(300);
    setItemActive(true);
    setLastBidTime(now);
    lastBidTimeRef.current = now;
    setIsPaused(false);
    showNotification(`Started: ${sortedItems[index].title}`);
  };
  
  const placeBid = (amount) => {
    if (!currentUser || isAuctioneer) {
      showNotification('Only bidders can place bids');
      return;
    }
    
    if (!itemActive) {
      showNotification('No active auction');
      return;
    }
    
    if (isPaused) {
      showNotification('Auction is paused - bidding disabled');
      return;
    }
    
    const bidder = bidders.find(b => b.name === currentUser);
    const currentHighBid = currentBids.length > 0 
      ? currentBids[currentBids.length - 1].amount 
      : 0;
    
    if (amount <= currentHighBid) {
      showNotification(`Bid must be higher than $${currentHighBid}`);
      return;
    }
    
    if (amount > bidder.balance) {
      showNotification(`Insufficient balance: $${bidder.balance}`);
      return;
    }
    
    const newBid = {
      id: generateId(),
      bidder: currentUser,
      amount,
      timestamp: Date.now()
    };
    
    setCurrentBids([...currentBids, newBid]);
    setLastBidTime(Date.now());
    setCustomBidAmount('');
    showNotification(`Bid placed: $${amount}`);
  };
  
  const handleQuickBid = (increment) => {
    const currentHigh = currentBids.length > 0 
      ? currentBids[currentBids.length - 1].amount 
      : 0;
    placeBid(currentHigh + increment);
  };
  
  const exportData = () => {
    const data = {
      auctioneerPassword,
      bidders,
      items,
      currentItemIndex,
      currentBids,
      setupComplete
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showNotification('Data exported');
  };
  
  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Update state
        const newPassword = data.auctioneerPassword || '';
        const newBidders = data.bidders || INITIAL_BIDDERS;
        const newItems = data.items || [];
        
        setAuctioneerPassword(newPassword);
        setBidders(newBidders);
        setItems(newItems);
        setCurrentItemIndex(data.currentItemIndex ?? -1);
        setCurrentBids(data.currentBids || []);
        setSetupComplete(data.setupComplete || false);
        
        // Sync to Firebase
        await updateFirebase('passwords/auctioneer', newPassword);
        await updateFirebase('bidders', newBidders);
        await updateFirebase('items', newItems);
        
        showNotification('Data imported and synced to all devices');
      } catch (err) {
        showNotification('Error importing data');
      }
    };
    reader.readAsText(file);
  };
  
  const currentBidder = currentUser && !isAuctioneer 
    ? bidders.find(b => b.name === currentUser) 
    : null;
  
  const currentHighBid = currentBids.length > 0 
    ? currentBids[currentBids.length - 1] 
    : null;
  
  const isHighBidder = currentHighBid && currentBidder 
    ? currentHighBid.bidder === currentBidder.name 
    : false;

  // Reset functions
  const resetBalances = async () => {
    if (window.confirm('Reset all balances to $500? (Items won will be kept)')) {
      const updatedBidders = bidders.map(b => ({ ...b, balance: 500 }));
      setBidders(updatedBidders);
      await updateFirebase('bidders', updatedBidders);
      showNotification('Balances reset to $500');
    }
  };
  
  const resetItemsWon = async () => {
    if (window.confirm('Clear all items won from bidders? (Balances will remain unchanged)')) {
      const updatedBidders = bidders.map(b => ({ ...b, itemsWon: [] }));
      setBidders(updatedBidders);
      await updateFirebase('bidders', updatedBidders);
      showNotification('Items won cleared');
    }
  };
  
  const restartAuction = () => {
    if (window.confirm('Restart auction from first unwon item? (Current item will stop, already won items stay won)')) {
      setItemActive(false);
      setCurrentBids([]);
      // Find first unwon item
      const firstUnwonIndex = sortedItems.findIndex(item => !item.winner);
      if (firstUnwonIndex >= 0) {
        setCurrentItemIndex(firstUnwonIndex);
        showNotification('Auction restarted - ready to start next unwon item');
      } else {
        setCurrentItemIndex(-1);
        showNotification('All items have been won!');
      }
    }
  };
  
  const resetAllData = async () => {
    if (window.confirm('⚠️ RESET EVERYTHING? This will delete all items, bids, and winners. Cannot be undone!')) {
      if (window.confirm('Are you ABSOLUTELY SURE? This action is permanent!')) {
        setBidders(INITIAL_BIDDERS);
        setItems([]);
        setCurrentItemIndex(-1);
        setCurrentBids([]);
        setItemActive(false);
        setAuctioneerPassword('');
        
        // Clear Firebase
        await updateFirebase('passwords/auctioneer', '');
        await updateFirebase('bidders', INITIAL_BIDDERS);
        await updateFirebase('items', []);
        await updateFirebase('auction', {
          currentItemIndex: -1,
          currentBids: [],
          timeRemaining: 300,
          itemActive: false,
          lastBidTime: null,
          isPaused: false
        });
        
        showNotification('All data has been reset and synced');
      }
    }
  };
  
  const endAuction = async () => {
    if (window.confirm('🏁 END AUCTION? This will stop any active item and prevent auto-advance.')) {
      // End current item if active
      if (itemActive && currentItem) {
        endCurrentItem();
      }
      
      // Stop auction
      setItemActive(false);
      setCurrentItemIndex(-1);
      setIsPaused(false);
      
      // Clear auto-advance
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
      
      showNotification('🏁 Auction ended');
    }
  };
  
  const pauseAuction = () => {
    setIsPaused(true);
    showNotification('Auction paused');
  };
  
  const resumeAuction = () => {
    setIsPaused(false);
    showNotification('Auction resumed');
  };
  
  const startNextItem = () => {
    if (itemActive) {
      showNotification('Please end current item first');
      return;
    }
    
    // Find next unwon item
    const nextUnwonIndex = sortedItems.findIndex((item, idx) => !item.winner && idx > currentItemIndex);
    
    if (nextUnwonIndex >= 0) {
      startItem(nextUnwonIndex);
    } else {
      // If no unwon items after current, check from beginning
      const firstUnwonIndex = sortedItems.findIndex(item => !item.winner);
      if (firstUnwonIndex >= 0) {
        startItem(firstUnwonIndex);
      } else {
        showNotification('All items have been won!');
      }
    }
  };

  // Styles
  const inputStyle = {
    backgroundColor: colors.sage,
    color: colors.text,
    border: `2px solid ${colors.emerald}`,
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '16px',
    width: '100%',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.2s'
  };

  const labelStyle = {
    color: colors.navy,
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    display: 'block',
    letterSpacing: '0.3px'
  };

  const buttonStyle = {
    backgroundColor: colors.emerald,
    color: colors.white,
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
  };

  const cardStyle = {
    backgroundColor: colors.white,
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    border: `1px solid ${colors.border}`
  };

  // Login view
  if (!currentUser) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.sage,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Georgia, serif'
      }}>
        <div style={{ ...cardStyle, maxWidth: '450px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ marginBottom: '16px' }}>
              <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill={colors.navy} textAnchor="middle">DD</text>
            </svg>
            <h1 style={{ 
              fontSize: '36px', 
              fontWeight: 'bold', 
              color: colors.navy,
              margin: '0 0 8px 0'
            }}>
              December Debutantes
            </h1>
            <p style={{ fontSize: '16px', color: colors.lightText, margin: 0 }}>
              Christmas Auction
            </p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            handleLogin(loginName, loginPassword);
          }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Name</label>
              <select
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select your name</option>
                <option value="auctioneer">Auctioneer</option>
                {bidders.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            
            <button
              type="submit"
              style={{ ...buttonStyle, width: '100%' }}
            >
              Login
            </button>
          </form>
        </div>
        
        {notification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: colors.emerald,
            color: colors.white,
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100
          }}>
            {notification}
          </div>
        )}
      </div>
    );
  }
  
  // Bidder view
  if (!isAuctioneer && currentBidder) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.sage,
        padding: '20px',
        fontFamily: 'Georgia, serif'
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <svg width="80" height="80" viewBox="0 0 100 100">
              <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill={colors.navy} textAnchor="middle">DD</text>
            </svg>
          </div>
          
          {/* Header */}
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.navy, margin: '0 0 4px 0' }}>
                  Welcome, {currentBidder.name}!
                </h2>
                <p style={{ fontSize: '14px', color: colors.lightText, margin: 0 }}>
                  December Debutantes Auction
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {currentBidder.name === 'Miguel' && (
                  <button
                    onClick={() => setIsAuctioneer(true)}
                    style={{
                      ...buttonStyle,
                      backgroundColor: colors.emerald,
                      padding: '8px 16px',
                      fontSize: '14px',
                      boxShadow: 'none'
                    }}
                  >
                    <Gavel size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Auctioneer
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  style={{
                    ...buttonStyle,
                    backgroundColor: colors.white,
                    color: colors.navy,
                    border: `2px solid ${colors.navy}`,
                    padding: '8px 16px',
                    fontSize: '14px',
                    boxShadow: 'none'
                  }}
                >
                  <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Logout
                </button>
              </div>
            </div>
          </div>
          
          {/* Balance */}
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                  Your Balance
                </div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: colors.emerald }}>
                  ${currentBidder.balance}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                  Items Won
                </div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: colors.navy }}>
                  {currentBidder.itemsWon ? currentBidder.itemsWon.length : 0}
                </div>
              </div>
            </div>
          </div>
          
          {/* Current item or waiting */}
          {currentItem && itemActive ? (
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: '12px', color: colors.emerald, marginBottom: '8px', fontWeight: '600' }}>
                ITEM #{currentItem.number}
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: colors.navy, margin: '0 0 16px 0' }}>
                {currentItem.title}
              </h2>
              
              {currentItem.imageUrl && (
                <img 
                  src={currentItem.imageUrl} 
                  alt={currentItem.title}
                  style={{ 
                    width: '100%', 
                    height: '300px', 
                    objectFit: 'cover', 
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}
                />
              )}
              
              <p style={{ fontSize: '16px', color: colors.lightText, marginBottom: '24px', lineHeight: '1.6' }}>
                {currentItem.description}
              </p>
              
              {/* Timer */}
              <div style={{
                backgroundColor: isPaused ? 'rgba(245, 158, 11, 0.1)' : colors.cream,
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '24px',
                border: `2px solid ${isPaused ? '#f59e0b' : timeRemaining <= 10 ? '#ef4444' : colors.border}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: colors.lightText }}>
                    {isPaused ? '⏸️ PAUSED' : 'Time Remaining:'}
                  </span>
                  <span style={{ 
                    fontSize: '28px', 
                    fontWeight: 'bold', 
                    color: isPaused ? '#f59e0b' : timeRemaining <= 10 ? '#ef4444' : colors.navy
                  }}>
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                  </span>
                </div>
                {isPaused && (
                  <div style={{ 
                    textAlign: 'center', 
                    marginTop: '8px',
                    color: '#f59e0b',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    Auction paused by auctioneer
                  </div>
                )}
                {timeRemaining <= 10 && !isPaused && (
                  <div style={{ 
                    textAlign: 'center', 
                    marginTop: '8px',
                    color: '#ef4444',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    ⚠️ FINAL SECONDS! ⚠️
                  </div>
                )}
              </div>
              
              {/* Current bid */}
              <div style={{
                backgroundColor: isHighBidder ? 'rgba(16, 185, 129, 0.1)' : colors.cream,
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px',
                border: `2px solid ${isHighBidder ? colors.emerald : colors.border}`
              }}>
                <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                  {isHighBidder ? 'You are the high bidder! 🎉' : 'Current High Bid'}
                </div>
                {currentHighBid ? (
                  <>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: colors.emerald }}>
                      ${currentHighBid.amount}
                    </div>
                    {!isHighBidder && (
                      <div style={{ fontSize: '14px', color: colors.lightText }}>
                        by {currentHighBid.bidder}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '18px', color: colors.lightText }}>
                    No bids yet - Be the first!
                  </div>
                )}
              </div>
              
              {/* Bidding buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {[10, 25, 50, 100].map(amount => (
                  <button
                    key={amount}
                    onClick={() => handleQuickBid(amount)}
                    style={buttonStyle}
                  >
                    +${amount}
                  </button>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="number"
                  value={customBidAmount}
                  onChange={(e) => setCustomBidAmount(e.target.value)}
                  placeholder="Custom amount"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => customBidAmount && placeBid(parseInt(customBidAmount))}
                  style={{ ...buttonStyle, minWidth: '100px' }}
                >
                  Bid
                </button>
              </div>
              
              {/* Recent bids */}
              {currentBids.length > 0 && (
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${colors.border}` }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px' }}>
                    Recent Bids
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflow: 'auto' }}>
                    {[...currentBids].reverse().slice(0, 5).map((bid) => (
                      <div key={bid.id} style={{
                        backgroundColor: colors.cream,
                        padding: '12px',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '14px'
                      }}>
                        <span style={{ color: colors.navy }}>{bid.bidder}</span>
                        <span style={{ color: colors.emerald, fontWeight: 'bold' }}>${bid.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '60px 32px' }}>
              <Gavel size={64} style={{ color: colors.lightText, margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '8px' }}>
                Waiting for Next Item
              </h3>
              <p style={{ fontSize: '16px', color: colors.lightText }}>
                The auctioneer will start the next item shortly
              </p>
            </div>
          )}
          
          {/* Your wins */}
          {currentBidder.itemsWon && currentBidder.itemsWon.length > 0 && (
            <div style={{ ...cardStyle, marginTop: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
                Your Wins
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentBidder.itemsWon.map((item) => (
                  <div key={item.id} style={{
                    backgroundColor: colors.cream,
                    padding: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.title} style={{ 
                        width: '60px', 
                        height: '60px', 
                        objectFit: 'cover', 
                        borderRadius: '6px' 
                      }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: colors.navy }}>
                        #{item.number} - {item.title}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.emerald, marginTop: '2px' }}>
                        ${item.winningBid}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ 
                marginTop: '16px', 
                paddingTop: '16px', 
                borderTop: `1px solid ${colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                <span style={{ color: colors.lightText }}>Total Spent:</span>
                <span style={{ color: colors.emerald }}>
                  ${currentBidder.itemsWon.reduce((sum, item) => sum + item.winningBid, 0)}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {notification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: colors.emerald,
            color: colors.white,
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100
          }}>
            {notification}
          </div>
        )}
      </div>
    );
  }
  
  // Auctioneer view
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: colors.sage,
      padding: '20px',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill={colors.navy} textAnchor="middle">DD</text>
          </svg>
        </div>
        
        {/* Header */}
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: colors.navy, margin: '0 0 4px 0' }}>
                Auctioneer Control Panel
              </h1>
              <p style={{ fontSize: '14px', color: colors.lightText, margin: 0 }}>
                December Debutantes Auction
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(currentUser === 'Miguel' || currentUser === 'auctioneer') && (
                <button
                  onClick={() => {
                    if (isAuctioneer) {
                      // Switch to bidder - but only if we know Miguel is the auctioneer
                      // We'll assume if logged in as auctioneer, it's Miguel
                      setIsAuctioneer(false);
                      setCurrentUser('Miguel');
                    }
                  }}
                  style={{
                    ...buttonStyle,
                    backgroundColor: colors.white,
                    color: colors.navy,
                    border: `2px solid ${colors.navy}`,
                    padding: '10px 20px',
                    fontSize: '14px',
                    boxShadow: 'none'
                  }}
                >
                  <User size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Switch to Bidder
                </button>
              )}
              <button
                onClick={handleLogout}
                style={{
                  ...buttonStyle,
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`,
                  padding: '10px 20px',
                  fontSize: '14px',
                  boxShadow: 'none'
                }}
              >
                <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Logout
              </button>
            </div>
          </div>
        </div>
        
        {/* Auction Controls */}
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
            Auction Controls
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {!itemActive ? (
              <button
                onClick={startNextItem}
                style={{
                  ...buttonStyle,
                  backgroundColor: colors.emerald,
                  fontSize: '16px',
                  padding: '16px'
                }}
              >
                ▶️ Start Next Item
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    onClick={resumeAuction}
                    style={{
                      ...buttonStyle,
                      backgroundColor: colors.emerald,
                      fontSize: '16px',
                      padding: '16px'
                    }}
                  >
                    ▶️ Resume Auction
                  </button>
                ) : (
                  <button
                    onClick={pauseAuction}
                    style={{
                      ...buttonStyle,
                      backgroundColor: '#f59e0b',
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                      fontSize: '16px',
                      padding: '16px'
                    }}
                  >
                    ⏸️ Pause Auction
                  </button>
                )}
                <button
                  onClick={() => {
                    endCurrentItem();
                  }}
                  style={{
                    ...buttonStyle,
                    backgroundColor: '#ef4444',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                    fontSize: '16px',
                    padding: '16px'
                  }}
                >
                  ⏹️ End Current Item
                </button>
              </>
            )}
          </div>
          {isPaused && itemActive && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#f59e0b',
              fontWeight: 'bold'
            }}>
              ⏸️ AUCTION PAUSED - Timer stopped, bidding disabled
            </div>
          )}
        </div>
        
        {/* Current Item (if active) */}
        {currentItem && itemActive && (
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: colors.emerald, marginBottom: '8px', fontWeight: '600' }}>
              CURRENTLY ACTIVE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.navy, margin: '0 0 8px 0' }}>
                  #{currentItem.number} - {currentItem.title}
                </h2>
                <p style={{ fontSize: '14px', color: colors.lightText, marginBottom: '16px' }}>
                  {currentItem.description}
                </p>
                {currentItem.imageUrl && (
                  <img 
                    src={currentItem.imageUrl} 
                    alt={currentItem.title}
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                )}
              </div>
              <div>
                <div style={{
                  backgroundColor: colors.cream,
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                    Time Remaining
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: timeRemaining <= 10 ? '#ef4444' : colors.navy }}>
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                  </div>
                </div>
                
                {currentHighBid ? (
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    textAlign: 'center',
                    border: `2px solid ${colors.emerald}`
                  }}>
                    <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                      Current High Bid
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: colors.emerald }}>
                      ${currentHighBid.amount}
                    </div>
                    <div style={{ fontSize: '14px', color: colors.navy }}>
                      by {currentHighBid.bidder}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: colors.cream,
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '14px', color: colors.lightText }}>
                      No bids yet
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    endCurrentItem();
                  }}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    backgroundColor: '#ef4444',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  End Item
                </button>
              </div>
            </div>
            
            {/* Bid history */}
            {currentBids.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px' }}>
                  Bid History
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[...currentBids].reverse().slice(0, 10).map((bid) => (
                    <div key={bid.id} style={{
                      backgroundColor: colors.cream,
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: colors.navy, fontWeight: 'bold' }}>{bid.bidder}</span>
                      <span style={{ color: colors.lightText, margin: '0 4px' }}>•</span>
                      <span style={{ color: colors.emerald, fontWeight: 'bold' }}>${bid.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          {/* Items List */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, margin: 0 }}>
                Auction Items ({sortedItems.length})
              </h3>
              <button
                onClick={() => setShowSetupModal(true)}
                style={{
                  ...buttonStyle,
                  padding: '8px 16px',
                  fontSize: '14px',
                  boxShadow: 'none'
                }}
              >
                <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Manage
              </button>
            </div>
            <div style={{ maxHeight: '600px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedItems.map((item, idx) => (
                <div key={item.id} style={{
                  backgroundColor: idx === currentItemIndex ? 'rgba(16, 185, 129, 0.1)' : colors.cream,
                  padding: '12px',
                  borderRadius: '8px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  border: idx === currentItemIndex ? `2px solid ${colors.emerald}` : `1px solid ${colors.border}`
                }}>
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.title} style={{ 
                      width: '60px', 
                      height: '60px', 
                      objectFit: 'cover', 
                      borderRadius: '6px' 
                    }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: colors.navy, fontSize: '14px' }}>
                      #{item.number} - {item.title}
                    </div>
                    {item.winner ? (
                      <div style={{ fontSize: '12px', color: colors.emerald, marginTop: '2px' }}>
                        Winner: {item.winner} - ${item.winningBid}
                      </div>
                    ) : idx === currentItemIndex ? (
                      <div style={{ fontSize: '12px', color: colors.emerald, marginTop: '2px' }}>
                        Currently Active
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: colors.lightText, marginTop: '2px' }}>
                        Not started
                      </div>
                    )}
                  </div>
                  {!item.winner && !itemActive && idx !== currentItemIndex && (
                    <button
                      onClick={() => startItem(idx)}
                      style={{
                        ...buttonStyle,
                        padding: '6px 16px',
                        fontSize: '14px',
                        boxShadow: 'none'
                      }}
                    >
                      Start
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Bidders Panel */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
              Bidders
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bidders.map((bidder) => (
                <div key={bidder.name} style={{
                  backgroundColor: colors.cream,
                  padding: '12px',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: colors.navy }}>{bidder.name}</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: colors.emerald }}>
                      ${bidder.balance}
                    </span>
                  </div>
                  {bidder.itemsWon && bidder.itemsWon.length > 0 && (
                    <div style={{ fontSize: '12px', color: colors.lightText }}>
                      Won {bidder.itemsWon.length} item{bidder.itemsWon.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
              <button
                onClick={() => setShowPasswordModal(true)}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: colors.emerald,
                  marginBottom: '12px'
                }}
              >
                <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Setup Passwords
              </button>
              
              <button
                onClick={() => setShowSetupModal(true)}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: colors.emerald,
                  marginBottom: '20px'
                }}
              >
                <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Manage Items
              </button>
              
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px' }}>
                Data Management
              </h4>
              <button
                onClick={exportData}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`,
                  boxShadow: 'none',
                  marginBottom: '8px'
                }}
              >
                <Download size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Export Data
              </button>
              <label style={{ display: 'block', marginBottom: '20px' }}>
                <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
                <div style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`,
                  boxShadow: 'none',
                  textAlign: 'center'
                }}>
                  <Upload size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Import Data
                </div>
              </label>
              
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px', marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
                Auction Controls
              </h4>
              <button
                onClick={endAuction}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#9333ea',
                  boxShadow: '0 2px 8px rgba(147, 51, 234, 0.3)',
                  marginBottom: '20px'
                }}
              >
                🏁 End Auction
              </button>
              
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px', marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
                Reset Options
              </h4>
              <button
                onClick={restartAuction}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#f59e0b',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                  marginBottom: '8px'
                }}
              >
                ↻ Restart from Next Unwon Item
              </button>
              <button
                onClick={resetBalances}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#f59e0b',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                  marginBottom: '8px'
                }}
              >
                💰 Reset All Balances to $500
              </button>
              <button
                onClick={resetItemsWon}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#f59e0b',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                  marginBottom: '8px'
                }}
              >
                🏆 Clear All Items Won
              </button>
              <button
                onClick={resetAllData}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                }}
              >
                ⚠️ Reset Everything
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Password Setup Modal */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 50
        }}>
          <div style={{
            ...cardStyle,
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.navy, margin: 0 }}>
                Password Setup
              </h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: colors.lightText
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.navy, margin: 0 }}>
                All Passwords
              </h3>
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                style={{
                  ...buttonStyle,
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`,
                  boxShadow: 'none'
                }}
              >
                {showPasswords ? '🙈 Hide' : '👁️ Show'} Passwords
              </button>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Auctioneer Password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={auctioneerPassword}
                onChange={(e) => setAuctioneerPassword(e.target.value)}
                style={inputStyle}
                placeholder="Set auctioneer password"
              />
            </div>
            
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
              Bidder Passwords
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              {bidders.map((bidder, idx) => (
                <div key={bidder.name}>
                  <label style={labelStyle}>{bidder.name}</label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={bidder.password}
                    onChange={(e) => {
                      const newBidders = [...bidders];
                      newBidders[idx].password = e.target.value;
                      setBidders(newBidders);
                    }}
                    style={inputStyle}
                    placeholder="Password"
                  />
                </div>
              ))}
            </div>
            
            <button
              onClick={async () => {
                if (!auctioneerPassword) {
                  showNotification('Please set an auctioneer password');
                  return;
                }
                const allPasswordsSet = bidders.every(b => b.password);
                if (!allPasswordsSet) {
                  showNotification('Please set passwords for all bidders');
                  return;
                }
                // Save to Firebase
                await updateFirebase('bidders', bidders);
                showNotification('Passwords saved to Firebase!');
              }}
              style={{
                ...buttonStyle,
                width: '100%',
                marginBottom: '24px'
              }}
            >
              💾 Save Passwords
            </button>
            
            <div style={{ paddingTop: '24px', borderTop: `2px solid ${colors.border}` }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
                Import / Export Data
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={exportData}
                  style={{
                    ...buttonStyle,
                    backgroundColor: colors.white,
                    color: colors.navy,
                    border: `2px solid ${colors.navy}`,
                    boxShadow: 'none'
                  }}
                >
                  <Download size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Export
                </button>
                <label>
                  <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
                  <div style={{
                    ...buttonStyle,
                    backgroundColor: colors.white,
                    color: colors.navy,
                    border: `2px solid ${colors.navy}`,
                    boxShadow: 'none',
                    textAlign: 'center'
                  }}>
                    <Upload size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Import
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Items Management Modal */}
      {showSetupModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 50
        }}>
          <div style={{
            ...cardStyle,
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.navy, margin: 0 }}>
                Manage Auction Items
              </h2>
              <button
                onClick={() => setShowSetupModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: colors.lightText
                }}
              >
                ✕
              </button>
            </div>
            
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
              Add New Item
            </h3>
            
            <ItemForm onSubmit={addItem} colors={colors} inputStyle={inputStyle} labelStyle={labelStyle} buttonStyle={buttonStyle} />
            
            <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: `2px solid ${colors.border}` }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
                All Items ({items.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedItems.map((item) => (
                  <div key={item.id} style={{
                    backgroundColor: colors.cream,
                    padding: '16px',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    border: `1px solid ${colors.border}`
                  }}>
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.title} style={{ 
                        width: '80px', 
                        height: '80px', 
                        objectFit: 'cover', 
                        borderRadius: '6px' 
                      }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: colors.navy }}>
                        #{item.number} - {item.title}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.lightText, marginTop: '4px' }}>
                        {item.description}
                      </div>
                      {item.winner && (
                        <div style={{ fontSize: '14px', color: colors.emerald, marginTop: '4px' }}>
                          Winner: {item.winner} - ${item.winningBid}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setEditingItem(item)}
                        style={{
                          ...buttonStyle,
                          padding: '8px 16px',
                          fontSize: '14px',
                          boxShadow: 'none'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        style={{
                          ...buttonStyle,
                          backgroundColor: '#ef4444',
                          padding: '8px 16px',
                          fontSize: '14px',
                          boxShadow: 'none'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {editingItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 60
        }}>
          <div style={{ ...cardStyle, maxWidth: '600px', width: '100%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
              Edit Item
            </h3>
            <ItemForm 
              initialData={editingItem}
              onSubmit={(data) => updateItem(editingItem.id, data)}
              onCancel={() => setEditingItem(null)}
              colors={colors}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
              buttonStyle={buttonStyle}
            />
          </div>
        </div>
      )}
      
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: colors.emerald,
          color: colors.white,
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 100
        }}>
          {notification}
        </div>
      )}
    </div>
  );
};

// Item form component
const ItemForm = ({ initialData, onSubmit, onCancel, colors, inputStyle, labelStyle, buttonStyle }) => {
  const [formData, setFormData] = useState(initialData || {
    number: '',
    title: '',
    description: '',
    imageUrl: ''
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.number || !formData.title) {
      alert('Number and title are required');
      return;
    }
    onSubmit(formData);
    if (!initialData) {
      setFormData({ number: '', title: '', description: '', imageUrl: '' });
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Item Number</label>
          <input
            type="number"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            style={inputStyle}
            required
          />
        </div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
        />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Image URL (Imgur)</label>
        <input
          type="url"
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          style={inputStyle}
          placeholder="https://i.imgur.com/xxxxx.jpg"
        />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          type="submit"
          style={{ ...buttonStyle, flex: 1 }}
        >
          {initialData ? 'Update' : 'Add'} Item
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              ...buttonStyle,
              backgroundColor: colors.white,
              color: colors.navy,
              border: `2px solid ${colors.navy}`
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default AuctionApp;
