'use client';

import { useCallback, useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getShortlinks } from '@/lib/actions/shortlinks';
import { validateMessage, getSuggestedReplacement } from '@/lib/messageUtils';
import styles from './WorkflowBuilder.module.css';

// Searchable Single-Select Component for Trigger Source
function SearchableSourceSelect({ 
  value, 
  onChange, 
  availableSources = [],
  placeholder = "Select source filter..."
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build options list with special options
  const allOptions = useMemo(() => {
    const specialOptions = [
      { value: null, label: 'All Sources (Catch-All)', icon: '🔥' },
      { value: '__DEFAULT__', label: 'Default (Unmatched Sources Only)', icon: '⚡' },
    ];
    const sourceOptions = availableSources.map(source => ({
      value: source,
      label: source,
      icon: '🎯'
    }));
    return [...specialOptions, ...sourceOptions];
  }, [availableSources]);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return allOptions;
    const query = searchQuery.toLowerCase();
    return allOptions.filter(opt => {
      const label = opt.label.toLowerCase();
      return label.includes(query);
    });
  }, [allOptions, searchQuery]);

  const selectedOption = allOptions.find(opt => opt.value === value);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={styles.searchableSelect} ref={containerRef}>
      <div 
        className={styles.selectTrigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.selectedValue}>
          {selectedOption ? (
            <span>
              <span className={styles.optionIcon}>{selectedOption.icon}</span>
              {selectedOption.label}
            </span>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        <span className={styles.dropdownArrow}>{isOpen ? '▲' : '▼'}</span>
      </div>
      
      {isOpen && (
        <div className={styles.selectDropdown}>
          <div className={styles.searchInputWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className={styles.optionsList}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value === null ? '__null__' : option.value}
                    className={`${styles.optionItem} ${isSelected ? styles.optionSelected : ''}`}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className={styles.optionIcon}>{option.icon}</span>
                    <span>{option.label}</span>
                    {isSelected && <span className={styles.checkmark}>✓</span>}
                  </div>
                );
              })
            ) : (
              <div className={styles.noResults}>No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Node Types
const TriggerNode = ({ data, selected, availableSources = [] }) => {
  const triggerType = data?.triggerType || 'newLead'; // 'newLead' or 'manualFire'
  // triggerSource values (only for newLead):
  // null = catch-all (fires on every lead)
  // "__DEFAULT__" = default (fires only if no other workflow matches the source)
  // string = specific source (fires only for that source)
  const triggerSource = data?.triggerSource ?? null;
  
  const getDescription = () => {
    if (triggerType === 'manualFire') {
      return '🎯 Manually triggered by user';
    }
    if (triggerSource === null) {
      return '🔥 Triggers for ALL sources (catch-all)';
    } else if (triggerSource === '__DEFAULT__') {
      return '⚡ Triggers for unmatched sources only (default)';
    } else {
      return `🎯 Triggers for source: "${triggerSource}"`;
    }
  };
  
  return (
    <div className={`${styles.node} ${styles.triggerNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>{triggerType === 'manualFire' ? '🎯' : '⚡'}</span>
        <span className={styles.nodeTitle}>{triggerType === 'manualFire' ? 'Manual Fire' : 'New Lead'}</span>
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.nodeDescription}>
          {getDescription()}
        </div>
        {triggerType === 'newLead' && (
          <div className={styles.nodeField}>
            <label>Source Filter:</label>
            <SearchableSourceSelect
              value={triggerSource}
              onChange={(value) => data.onChange?.('triggerSource', value)}
              availableSources={availableSources}
              placeholder="Select source filter..."
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className={styles.nodeHandle} id="source" />
    </div>
  );
};

const ActionNode = ({ data, selected, id, onDelete, availableShortlinks = [], optOutText = '' }) => {
  const handleShortlinkInsert = (e) => {
    e.stopPropagation();
    const shortlink = availableShortlinks.find(s => s.id === parseInt(e.target.value));
    if (shortlink) {
      // Insert marker format that will be replaced with code when sending
      const shortlinkMarker = `{{SHORTLINK:${shortlink.id}}}`;
      const currentMessage = data.message || '';
      data.onChange?.('message', currentMessage + (currentMessage ? ' ' : '') + shortlinkMarker);
      e.target.value = '';
    }
  };

  // Calculate character count from the display value (with URLs expanded)
  const displayValue = (() => {
    let value = data.message || '';
    value = value.replace(/\{\{SHORTLINK:(\d+)\}\}/g, (match, id) => {
      const shortlink = availableShortlinks.find(s => s.id === parseInt(id, 10));
      const displayName = shortlink?.nickname || `link-${id}`;
      return `https://txt.cx/${displayName}`;
    });
    return value;
  })();

  return (
    <div className={`${styles.node} ${styles.actionNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>📤</span>
        <span className={styles.nodeTitle}>Send Message</span>
        {id !== '1' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            className={styles.deleteNodeButton}
            title="Delete node"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.nodeField}>
          <div className={styles.messageHeader}>
            <label>Message Content</label>
            {availableShortlinks.length > 0 ? (
              <select
                onChange={handleShortlinkInsert}
                className={styles.shortlinkSelect}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                defaultValue=""
                title="Insert a shortlink into your message"
              >
                <option value="">🔗 Insert Shortlink...</option>
                {availableShortlinks.map(shortlink => (
                  <option key={shortlink.id} value={shortlink.id}>
                    {shortlink.nickname || `Shortlink #${shortlink.id}`}
                  </option>
                ))}
              </select>
            ) : (
              <span className={styles.noShortlinksHint} title="Create shortlinks in the Shortlinks page to insert them here">
                No shortlinks available
              </span>
            )}
          </div>
          <div className={styles.messagePreview}>
            <textarea
              value={displayValue}
              onChange={(e) => {
                // Convert URLs back to markers when user edits
                let newValue = e.target.value;
                // Replace shortlink URLs back to markers
                availableShortlinks.forEach(shortlink => {
                  const url = `https://txt.cx/${shortlink.nickname || `link-${shortlink.id}`}`;
                  // Use a regex that matches the URL and replaces with marker
                  const regex = new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                  newValue = newValue.replace(regex, `{{SHORTLINK:${shortlink.id}}}`);
                });
                data.onChange?.('message', newValue);
              }}
              placeholder="Enter your SMS message"
              rows={4}
              className={styles.nodeInput}
              onClick={(e) => e.stopPropagation()}
            />
            <div 
              className={styles.messageDisplay}
              dangerouslySetInnerHTML={{ 
                __html: (() => {
                  let formatted = data.message || '';
                  // Escape HTML first
                  formatted = formatted
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                  
                  // Replace {{SHORTLINK:ID}} markers with styled URLs
                  formatted = formatted.replace(/\{\{SHORTLINK:(\d+)\}\}/g, (match, id) => {
                    const shortlink = availableShortlinks.find(s => s.id === parseInt(id, 10));
                    const displayName = shortlink?.nickname || `link-${id}`;
                    const url = `https://txt.cx/${displayName}`;
                    return `<span class="${styles.shortlinkUrl}">${url}</span>`;
                  });
                  // Also format regular URLs
                  formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, (url) => {
                    return `<span class="${styles.shortlinkUrl}">${url}</span>`;
                  });
                  return formatted;
                })()
              }}
            />
          </div>
          {(() => {
            const rawMessage = data.message || '';
            const effectiveMessage = optOutText
              ? `${displayValue}${displayValue ? '\n\n' : ''}${optOutText}`
              : displayValue;
            const validation = validateMessage(effectiveMessage);
            const messageSuggestion = getSuggestedReplacement(rawMessage);
            return (
              <>
                <div className={styles.charCount}>
                  {optOutText ? (
                    <>Characters: {validation.characterCount} (message: {displayValue.length} + opt-out: {optOutText.length + (displayValue ? 2 : 0)})</>
                  ) : (
                    <>Characters: {validation.characterCount}</>
                  )}
                  {validation.parts > 0 && (
                    <span> • Est. {validation.parts} part{validation.parts !== 1 ? 's' : ''}</span>
                  )}
                </div>
                {validation.encodingWarning && (
                  <div className={styles.encodingWarning}>
                    <p><strong>Warning:</strong> {validation.encodingWarning}</p>
                    {validation.nonGsmChars?.length > 0 && (
                      <p>Non-GSM characters: {validation.nonGsmChars.map(c => `"${c}"`).join(', ')}</p>
                    )}
                    {messageSuggestion.hasReplacement && (
                      <button
                        type="button"
                        className={styles.replaceButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          data.onChange?.('message', messageSuggestion.fixedText);
                        }}
                      >
                        Replace with ASCII equivalents
                      </button>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
      <Handle type="target" position={Position.Left} className={styles.nodeHandle} id="target" />
      <Handle type="source" position={Position.Right} className={styles.nodeHandle} id="source" />
    </div>
  );
};

const SegmentationNode = ({ data, selected, id, onDelete }) => {
  const [conditions, setConditions] = useState(data.conditions || []);

  useEffect(() => {
    if (data.conditions) {
      setConditions(data.conditions);
    }
  }, [data.conditions]);

  const addCondition = () => {
    const newCondition = { field: '', operator: 'equals', value: '' };
    const updated = [...conditions, newCondition];
    setConditions(updated);
    data.onChange?.('conditions', updated);
  };

  const updateCondition = (index, field, value) => {
    setConditions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      data.onChange?.('conditions', updated);
      return updated;
    });
  };

  const removeCondition = (index) => {
    const updated = conditions.filter((_, i) => i !== index);
    setConditions(updated);
    data.onChange?.('conditions', updated);
  };

  return (
    <div className={`${styles.node} ${styles.segmentationNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>🔀</span>
        <span className={styles.nodeTitle}>Segment Contacts</span>
        {id !== '1' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            className={styles.deleteNodeButton}
            title="Delete node"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.conditionsList}>
          {conditions.map((condition, index) => (
            <div key={index} className={styles.conditionRow}>
              <select
                value={condition.field || ''}
                onChange={(e) => {
                  const newField = e.target.value;
                  // Update all fields at once for special fields
                  if (newField === 'clicked' || newField === 'opened') {
                    setConditions(prev => {
                      const updated = [...prev];
                      updated[index] = { 
                        ...updated[index], 
                        field: newField,
                        operator: 'equals',
                        value: 'never'
                      };
                      data.onChange?.('conditions', updated);
                      return updated;
                    });
                  } else {
                    updateCondition(index, 'field', newField);
                  }
                }}
                className={styles.conditionSelect}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <option value="">Select field...</option>
                <option value="source">Source</option>
                <option value="age">Age</option>
                <option value="subscribed">Subscribed</option>
                <option value="tags">Tags</option>
                <option value="clickid">Click ID</option>
                <option value="clicked">Clicked?</option>
                <option value="opened">Opened?</option>
              </select>
              <select
                value={condition.operator}
                onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                className={styles.conditionSelect}
                onClick={(e) => e.stopPropagation()}
                disabled={condition.field === 'clicked' || condition.field === 'opened'}
              >
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="notEquals">Not Equals</option>
              </select>
              {condition.field === 'clicked' || condition.field === 'opened' ? (
                <select
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  className={styles.conditionSelect}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="never">Never</option>
                  <option value="ever">Ever</option>
                  <option value="within_campaign">Within Campaign</option>
                  <option value="within_last_message">Within Last Message</option>
                  <option value="within_24h">Within Last 24 Hours</option>
                  <option value="within_7d">Within Last 7 Days</option>
                  <option value="within_30d">Within Last 30 Days</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  placeholder="Value"
                  className={styles.conditionInput}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeCondition(index);
                }}
                className={styles.removeButton}
              >
                ×
              </button>
            </div>
          ))}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              addCondition();
            }} 
            className={styles.addConditionButton}
          >
            + Add Condition
          </button>
        </div>
      </div>
      <Handle type="target" position={Position.Top} className={styles.nodeHandle} id="target" />
      <Handle type="source" position={Position.Bottom} className={styles.nodeHandle} id="source-true" />
      <Handle type="source" position={Position.Right} className={styles.nodeHandle} id="source-false" />
      <div className={styles.handleLabel} style={{ position: 'absolute', bottom: '-1.5rem', left: 'calc(50% + 10px)', transform: 'translateX(-50%)' }}>YES</div>
      <div className={styles.handleLabel} style={{ position: 'absolute', right: '-3rem', top: '50%', transform: 'translateY(-50%)' }}>NO</div>
    </div>
  );
};

const DelayNode = ({ data, selected, id, onDelete }) => {
  const [delayValue, setDelayValue] = useState(data.delayValue || '');
  const [delayUnit, setDelayUnit] = useState(data.delayUnit || 'minutes');

  useEffect(() => {
    if (data.delayValue !== undefined) setDelayValue(data.delayValue);
    if (data.delayUnit) setDelayUnit(data.delayUnit);
  }, [data.delayValue, data.delayUnit]);

  const handleValueChange = (e) => {
    const value = e.target.value;
    setDelayValue(value);
    data.onChange?.('delayValue', value);
  };

  const handleUnitChange = (e) => {
    const unit = e.target.value;
    setDelayUnit(unit);
    data.onChange?.('delayUnit', unit);
  };

  return (
    <div className={`${styles.node} ${styles.delayNode} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>⏱️</span>
        <span className={styles.nodeTitle}>Time Delay</span>
        {id !== '1' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            className={styles.deleteNodeButton}
            title="Delete node"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.nodeField}>
          <label>Delay:</label>
          <div className={styles.delayInputGroup}>
            <input
              type="number"
              value={delayValue}
              onChange={handleValueChange}
              placeholder="0"
              min="0"
              className={styles.delayInput}
              onClick={(e) => e.stopPropagation()}
            />
            <select
              value={delayUnit}
              onChange={handleUnitChange}
              className={styles.delayUnitSelect}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className={styles.nodeHandle} id="target" />
      <Handle type="source" position={Position.Right} className={styles.nodeHandle} id="source" />
    </div>
  );
};

const createNodeTypes = (onDelete, availableShortlinks = [], availableSources = [], optOutText = '') => ({
  trigger: (props) => <TriggerNode {...props} availableSources={availableSources} />,
  action: (props) => <ActionNode {...props} onDelete={onDelete} availableShortlinks={availableShortlinks} optOutText={optOutText} />,
  segmentation: (props) => <SegmentationNode {...props} onDelete={onDelete} />,
  delay: (props) => <DelayNode {...props} onDelete={onDelete} />,
});

const initialNodes = [];
const initialEdges = [];

const WorkflowBuilder = forwardRef(function WorkflowBuilder({ workflow, onSave, campaignId, campaignName, onCampaignNameChange }, ref) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [availableShortlinks, setAvailableShortlinks] = useState([]);
  const [availableSources, setAvailableSources] = useState([]);
  const [optOutText, setOptOutText] = useState('');

  useEffect(() => {
    const loadShortlinks = async () => {
      try {
        const shortlinks = await getShortlinks();
        setAvailableShortlinks(shortlinks);
      } catch (error) {
        console.error('Error loading shortlinks:', error);
      }
    };
    loadShortlinks();
  }, []);

  useEffect(() => {
    const loadSources = async () => {
      try {
        const { getContacts } = await import('@/lib/actions/contacts');
        const contacts = await getContacts();
        const uniqueSources = [...new Set(contacts.map(c => c.source).filter(Boolean))].sort();
        setAvailableSources(uniqueSources);
      } catch (error) {
        console.error('Error loading sources:', error);
      }
    };
    loadSources();
  }, []);

  useEffect(() => {
    const loadOptOut = async () => {
      try {
        const res = await fetch('/api/user/opt-out-text');
        if (res.ok) {
          const { optOutText: text } = await res.json();
          setOptOutText(text || '');
        }
      } catch (error) {
        console.error('Error loading opt-out text:', error);
      }
    };
    loadOptOut();
  }, []);

  const handleDeleteNode = useCallback((nodeId) => {
    if (nodeId === '1') return; // Don't allow deleting trigger node
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
    setEditingNode(null);
  }, [setNodes, setEdges]);

  // Handle keyboard deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && selectedNodeId !== '1') {
        e.preventDefault();
        handleDeleteNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, handleDeleteNode]);

  const onConnect = useCallback(
    (params) => {
      // Allow connections to trigger nodes (they can be targets now)
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onNodesDelete = useCallback((deleted) => {
    const deletedIds = deleted.map((n) => n.id);
    setNodes((nds) => nds.filter((node) => !deletedIds.includes(node.id)));
    setEdges((eds) => eds.filter((edge) => !deletedIds.includes(edge.source) && !deletedIds.includes(edge.target)));
  }, [setNodes, setEdges]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.id);
    setEditingNode(null);
  }, []);

  const onNodeDoubleClick = useCallback((event, node) => {
    if (node.id !== '1') { // Don't allow editing trigger node
      setEditingNode(node);
    }
  }, []);

  const onNodeDataChange = useCallback((nodeId, field, value) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              [field]: value,
              onChange: (f, v) => onNodeDataChange(nodeId, f, v),
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Update nodes with onChange handlers and delete function
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
      data: {
        ...node.data,
        onChange: (field, value) => onNodeDataChange(node.id, field, value),
      },
    }));
  }, [nodes, onNodeDataChange, selectedNodeId]);

  const addNode = (type, triggerType = null) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400 + 200, y: Math.random() * 400 + 200 },
      data: { 
        label: type === 'trigger' 
          ? (triggerType === 'manualFire' ? 'Manual Fire' : 'New Lead')
          : type === 'action' ? 'Send Message' 
          : type === 'segmentation' ? 'Segment Contacts'
          : 'Time Delay',
        triggerType: type === 'trigger' ? (triggerType || 'newLead') : undefined,
        triggerSource: type === 'trigger' && triggerType !== 'manualFire' ? null : undefined,
        message: type === 'action' ? '' : undefined,
        conditions: type === 'segmentation' ? [] : undefined,
        delayValue: type === 'delay' ? '' : undefined,
        delayUnit: type === 'delay' ? 'minutes' : undefined,
        onChange: (field, value) => onNodeDataChange(newNode.id, field, value),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const getCurrentWorkflow = useCallback(() => {
    // Clean up nodes before saving (remove onChange handlers and React Flow internal props)
    const cleanNodes = nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        message: node.data?.message,
        conditions: node.data?.conditions,
        delayValue: node.data?.delayValue,
        delayUnit: node.data?.delayUnit,
        triggerType: node.data?.triggerType, // Include trigger type
        triggerSource: node.data?.triggerSource, // Include trigger source configuration
        label: node.data?.label,
      },
    }));
    
    return {
      nodes: cleanNodes,
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
    };
  }, [nodes, edges]);

  const handleSave = () => {
    // Validate workflow has at least one trigger node
    const hasTrigger = nodes.some(node => node.type === 'trigger');
    if (!hasTrigger) {
      alert('Workflow must have at least one trigger node. Please add a trigger from the Trigger Nodes section.');
      return;
    }
    
    const workflowData = getCurrentWorkflow();
    onSave(workflowData);
  };

  // Expose getCurrentWorkflow method via ref
  useImperativeHandle(ref, () => ({
    getCurrentWorkflow,
  }));

  const nodeTypes = useMemo(() => createNodeTypes(handleDeleteNode, availableShortlinks, availableSources, optOutText), [handleDeleteNode, availableShortlinks, availableSources, optOutText]);

  const workflowStats = useMemo(() => {
    const actionNodes = nodes.filter(n => n.type === 'action').length;
    const segmentationNodes = nodes.filter(n => n.type === 'segmentation').length;
    const totalConnections = edges.length;
    return { actionNodes, segmentationNodes, totalConnections, totalNodes: nodes.length };
  }, [nodes, edges]);

  return (
    <div className={styles.workflowBuilder}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.nameInputGroup}>
            <label htmlFor="campaignName">Campaign Name</label>
            <input
              id="campaignName"
              type="text"
              value={campaignName || ''}
              onChange={(e) => onCampaignNameChange?.(e.target.value)}
              placeholder="Enter campaign name"
              className={styles.campaignNameInput}
            />
          </div>
          <div className={styles.nodePalette}>
            <div className={styles.paletteSection}>
              <h3>Trigger Nodes</h3>
              <button onClick={() => addNode('trigger', 'newLead')} className={styles.paletteButton}>
                ⚡ New Lead
              </button>
              <button onClick={() => addNode('trigger', 'manualFire')} className={styles.paletteButton}>
                🎯 Manual Fire
              </button>
            </div>
            <div className={styles.paletteSection}>
              <h3>Add Node</h3>
              <button onClick={() => addNode('action')} className={styles.paletteButton}>
                📤 Send Message
              </button>
              <button onClick={() => addNode('segmentation')} className={styles.paletteButton}>
                🔀 Segment Contacts
              </button>
              <button onClick={() => addNode('delay')} className={styles.paletteButton}>
                ⏱️ Time Delay
              </button>
            </div>
          </div>
        </div>
        <div className={styles.workflowStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Nodes:</span>
            <span className={styles.statValue}>{workflowStats.totalNodes}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Actions:</span>
            <span className={styles.statValue}>{workflowStats.actionNodes}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Segments:</span>
            <span className={styles.statValue}>{workflowStats.segmentationNodes}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Connections:</span>
            <span className={styles.statValue}>{workflowStats.totalConnections}</span>
          </div>
        </div>
        <div className={styles.actions}>
          <button onClick={handleSave} className={styles.saveButton}>
            Save Workflow
          </button>
        </div>
      </div>
      <div className={styles.canvas}>
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          connectionLineStyle={{ stroke: '#ff6b35', strokeWidth: 2 }}
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: '#ff6b35' },
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#ff6b35',
            },
          }}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode={['Meta', 'Control']}
        >
          <Background />
          <Controls className={styles.reactFlowControls} />
          <MiniMap 
            className={styles.reactFlowMinimap}
            nodeColor={(node) => {
              if (node.type === 'trigger') return '#10b981';
              if (node.type === 'action') return '#ff6b35';
              if (node.type === 'segmentation') return '#3b82f6';
              return '#71717a';
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
          />
        </ReactFlow>
      </div>
    </div>
  );
});

export default WorkflowBuilder;

