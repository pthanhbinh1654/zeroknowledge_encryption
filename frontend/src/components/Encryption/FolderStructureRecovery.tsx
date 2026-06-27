import React, { useState, useCallback } from 'react';
import { 
  FolderIcon, 
  DocumentIcon, 
  ChevronRightIcon, 
  ChevronDownIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { 
  Box, 
  Typography, 
  Button, 
  Paper,
  Stack,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Tooltip,
  Alert
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'react-hot-toast';

// ==================================================
// TYPES & INTERFACES
// ==================================================

export interface FolderNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  data?: Uint8Array;
  children?: FolderNode[];
  parent?: string;
  depth: number;
}

export interface FolderStructureInfo {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  maxDepth: number;
  rootFolders: string[];
}

interface FolderStructureRecoveryProps {
  decryptedFiles: Array<{
    name: string;
    size: number;
    type: string;
    data: Uint8Array;
    path?: string;
    isFolder?: boolean;
  }>;
  onDownloadFile: (file: any) => void;
  onDownloadFolder: (folderPath: string, files: any[]) => void;
  onDownloadAll: () => void;
}

// ==================================================
// FOLDER STRUCTURE RECOVERY COMPONENT
// ==================================================

const FolderStructureRecovery: React.FC<FolderStructureRecoveryProps> = ({
  decryptedFiles,
  onDownloadFile,
  onDownloadFolder,
  onDownloadAll
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  // ==================================================
  // FOLDER STRUCTURE BUILDING
  // ==================================================

  const buildFolderStructure = useCallback((): { tree: FolderNode[], info: FolderStructureInfo } => {
    const nodeMap = new Map<string, FolderNode>();
    const rootNodes: FolderNode[] = [];
    
    let totalSize = 0;
    let maxDepth = 0;
    const rootFolders = new Set<string>();

    // Create nodes for all files
    decryptedFiles.forEach(file => {
      const path = file.path || file.name;
      const pathParts = path.split('/').filter(part => part.length > 0);
      
      maxDepth = Math.max(maxDepth, pathParts.length);
      totalSize += file.size;

      // Create folder nodes
      for (let i = 0; i < pathParts.length; i++) {
        const currentPath = pathParts.slice(0, i + 1).join('/');
        const isFile = i === pathParts.length - 1;
        const parentPath = i > 0 ? pathParts.slice(0, i).join('/') : '';

        if (!nodeMap.has(currentPath)) {
          const node: FolderNode = {
            name: pathParts[i],
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            size: isFile ? file.size : undefined,
            data: isFile ? file.data : undefined,
            children: isFile ? undefined : [],
            parent: parentPath || undefined,
            depth: i
          };

          nodeMap.set(currentPath, node);

          // Add to parent or root
          if (parentPath && nodeMap.has(parentPath)) {
            const parent = nodeMap.get(parentPath)!;
            parent.children!.push(node);
          } else if (i === 0) {
            rootNodes.push(node);
            rootFolders.add(pathParts[0]);
          }
        }
      }
    });

    // Calculate folder sizes
    const calculateFolderSize = (node: FolderNode): number => {
      if (node.type === 'file') {
        return node.size || 0;
      }
      
      let totalSize = 0;
      if (node.children) {
        for (const child of node.children) {
          totalSize += calculateFolderSize(child);
        }
      }
      node.size = totalSize;
      return totalSize;
    };

    rootNodes.forEach(calculateFolderSize);

    const info: FolderStructureInfo = {
      totalFiles: decryptedFiles.length,
      totalFolders: nodeMap.size - decryptedFiles.length,
      totalSize,
      maxDepth,
      rootFolders: Array.from(rootFolders)
    };

    return { tree: rootNodes, info };
  }, [decryptedFiles]);

  const { tree, info } = buildFolderStructure();

  // ==================================================
  // EVENT HANDLERS
  // ==================================================

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const toggleSelection = useCallback((path: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const handleDownloadSelected = useCallback(() => {
    if (selectedItems.size === 0) {
      toast.error('Vui lòng chọn ít nhất một item để tải xuống');
      return;
    }

    const selectedFiles = decryptedFiles.filter(file => 
      selectedItems.has(file.path || file.name)
    );

    if (selectedFiles.length === 1) {
      onDownloadFile(selectedFiles[0]);
    } else {
      // Create ZIP for selected files
      try {
        const zip = new JSZip();
        
        selectedFiles.forEach(file => {
          const path = file.path || file.name;
          zip.file(path, file.data);
        });
        
        zip.generateAsync({ type: 'blob' }).then(content => {
          const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
          saveAs(content, `selected_files_${timestamp}.zip`);
          toast.success(`Đã tải xuống ${selectedFiles.length} file đã chọn`);
        });
      } catch (error) {
        toast.error(`Lỗi khi tạo ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [selectedItems, decryptedFiles, onDownloadFile]);

  const expandAll = useCallback(() => {
    const allFolderPaths = new Set<string>();
    const collectFolderPaths = (nodes: FolderNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'folder') {
          allFolderPaths.add(node.path);
          if (node.children) {
            collectFolderPaths(node.children);
          }
        }
      });
    };
    collectFolderPaths(tree);
    setExpandedFolders(allFolderPaths);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  // ==================================================
  // RENDER HELPERS
  // ==================================================

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderTreeNode = (node: FolderNode): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedItems.has(node.path);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <motion.div
        key={node.path}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ListItemButton
          onClick={() => toggleSelection(node.path)}
          selected={isSelected}
          className={`pl-${node.depth * 4 + 2} hover:bg-gray-100 dark:hover:bg-gray-800`}
        >
          <ListItemIcon className="min-w-0 mr-2">
            {node.type === 'folder' && hasChildren && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(node.path);
                }}
                className="mr-1"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </IconButton>
            )}
            {node.type === 'folder' ? (
              <FolderIcon className="h-5 w-5 text-yellow-500" />
            ) : (
              <DocumentIcon className="h-5 w-5 text-blue-500" />
            )}
          </ListItemIcon>
          
          <ListItemText
            primary={node.name}
            secondary={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>{formatFileSize(node.size || 0)}</span>
                {node.type === 'folder' && node.children && (
                  <Chip 
                    label={`${node.children.length} items`} 
                    size="small" 
                    variant="outlined"
                  />
                )}
              </Stack>
            }
          />
          
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              if (node.type === 'file') {
                onDownloadFile({
                  name: node.name,
                  size: node.size,
                  data: node.data,
                  path: node.path
                });
              } else {
                const folderFiles = decryptedFiles.filter(file => 
                  (file.path || file.name).startsWith(node.path + '/')
                );
                onDownloadFolder(node.path, folderFiles);
              }
            }}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </IconButton>
        </ListItemButton>

        {node.type === 'folder' && hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {node.children!.map(child => renderTreeNode(child))}
            </List>
          </Collapse>
        )}
      </motion.div>
    );
  };

  return (
    <Paper className="p-6">
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" className="mb-4">
        <Typography variant="h6">
          Cấu trúc thư mục đã khôi phục
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={expandAll}>Mở rộng tất cả</Button>
          <Button size="small" onClick={collapseAll}>Thu gọn tất cả</Button>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleDownloadSelected}
            disabled={selectedItems.size === 0}
          >
            Tải đã chọn ({selectedItems.size})
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            onClick={onDownloadAll}
            startIcon={<ArrowDownTrayIcon className="h-4 w-4" />}
          >
            Tải tất cả
          </Button>
        </Stack>
      </Stack>

      {/* Structure Info */}
      <Alert severity="info" className="mb-4">
        <Stack direction="row" spacing={4} alignItems="center">
          <span><strong>{info.totalFiles}</strong> file</span>
          <span><strong>{info.totalFolders}</strong> thư mục</span>
          <span><strong>{formatFileSize(info.totalSize)}</strong> tổng dung lượng</span>
          <span><strong>{info.maxDepth}</strong> cấp độ sâu</span>
        </Stack>
      </Alert>

      {/* Tree View */}
      <Box className="max-h-96 overflow-y-auto border rounded">
        <List dense>
          {tree.map(node => renderTreeNode(node))}
        </List>
      </Box>
    </Paper>
  );
};

export default FolderStructureRecovery;
