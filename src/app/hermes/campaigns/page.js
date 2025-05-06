'use client'
import { useState } from 'react'

export default function Campaigns() {
  const [selectedTags, setSelectedTags] = useState([])
  const [targetAllSubscribed, setTargetAllSubscribed] = useState(false)

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Campaigns</h1>
        <input 
          type="search" 
          placeholder="Search campaigns..." 
          className="search-bar"
        />
      </header>

      {/* Campaign Creation Form */}
      <div className="campaign-form">
        <h2>Create New Campaign</h2>
        <input 
          type="text" 
          placeholder="Campaign Name" 
          className="input"
        />
        
        {/* Target Selection */}
        <div className="target-selection">
          <h3>Define Target Audience</h3>
          
          {/* All Subscribed Toggle */}
          <div className="target-option">
            <label>
              <input
                type="checkbox"
                checked={targetAllSubscribed}
                onChange={(e) => setTargetAllSubscribed(e.target.checked)}
              />
              All Subscribed Contacts
            </label>
          </div>

          {/* Or select specific tags */}
          {!targetAllSubscribed && (
            <div className="tag-selection">
              <h4>Select Tags</h4>
              {/* Tag checkboxes would be populated from the database */}
              <div className="tags-grid">
                {/* Example tag selection */}
                <label>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTags(prev => [...prev, 'tag-id'])
                      } else {
                        setSelectedTags(prev => prev.filter(id => id !== 'tag-id'))
                      }
                    }}
                  />
                  Tag Name
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-content">
        {/* Existing campaigns list */}
      </div>
    </div>
  )
} 