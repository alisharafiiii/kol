import { redis } from './redis';
import { v4 as uuidv4 } from 'uuid';
import type { Pipeline } from '@upstash/redis';

// Project interface for collaboration projects
export interface Project {
  id: string
  twitterHandle: string
  profileImageUrl?: string
  followerCount: number
  badgeType?: 'gold' | 'blue' | 'none'
  priority: 'low' | 'medium' | 'high'
  stage: 'dmd' | 'replied' | 'no-reply' | 'meeting' | 'no-budget' | 'high-budget' | 'completed' | 'rejected'
  socialLinks: Record<string, string>
  website?: string
  notes?: string
  assignedTo?: string // User ID who's handling this project
  createdBy: string // User ID who created the project
  createdAt: string // ISO timestamp
  updatedAt?: string
  updatedBy?: string
}

// Create a new project
export async function createProject(projectData: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
  const id = uuidv4();
  const project: Project = {
    ...projectData,
    id,
    createdAt: new Date().toISOString(),
  };
  
  try {
    // Save the project data first
    await saveProject(project);
    
    // Then ensure all indexes are properly updated
    await indexProject(project);
    
    return project;
  } catch (error) {
    console.error('Error creating project:', error);
    throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Save project to Redis
export async function saveProject(project: Project): Promise<void> {
  try {
    // Ensure data is clean by stringifying and parsing
    const cleanProject = JSON.parse(JSON.stringify(project));
    
    // Ensure website has https:// if provided
    if (cleanProject.website && !cleanProject.website.match(/^https?:\/\//i)) {
      cleanProject.website = `https://${cleanProject.website}`;
    }
    
    // Try to save as JSON first
    try {
      await redis.json.set(`project:${project.id}`, '$', cleanProject);
      console.log(`Project data saved as JSON successfully: ${project.id} (${project.twitterHandle})`);
    } catch (jsonError) {
      console.log(`Failed to save as JSON, saving as string: ${project.id}`, jsonError);
      // Fallback to saving as string
      await redis.set(`project:${project.id}`, JSON.stringify(cleanProject));
      console.log(`Project data saved as string successfully: ${project.id} (${project.twitterHandle})`);
    }
  } catch (error) {
    console.error('Error saving project to Redis:', error);
    console.error('Project data causing error:', project);
    throw new Error(`Failed to save project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Add a separate function for indexing to maintain consistency
async function indexProject(project: Project): Promise<void> {
  try {
    // Index by stage
    await redis.sadd(`idx:project:stage:${project.stage}`, project.id);
    
    // Index by priority
    await redis.sadd(`idx:project:priority:${project.priority}`, project.id);
    
    // Index by assignee (normalize if it's a Twitter handle)
    if (project.assignedTo) {
      const normalizedAssignee = project.assignedTo.replace('@', '').toLowerCase();
      await redis.sadd(`idx:project:assignee:${normalizedAssignee}`, project.id);
      // Also keep the original for backwards compatibility
      await redis.sadd(`idx:project:assignee:${project.assignedTo}`, project.id);
    }
    
    // Index by creator (normalize if it's a Twitter handle)
    const normalizedCreator = project.createdBy.replace('@', '').toLowerCase();
    await redis.sadd(`idx:project:creator:${normalizedCreator}`, project.id);
    // Also keep the original for backwards compatibility
    await redis.sadd(`idx:project:creator:${project.createdBy}`, project.id);
    
    // Index by Twitter handle (case insensitive)
    const normalizedHandle = project.twitterHandle.toLowerCase().replace('@', '');
    await redis.sadd(`idx:project:twitter:${normalizedHandle}`, project.id);
    
    console.log(`Project indices updated successfully: ${project.id} (${project.twitterHandle})`);
    console.log(`Indexed by creator: ${normalizedCreator} and ${project.createdBy}`);
    
    // Add to global set for quick 'all' retrieval
    await redis.sadd('projects:all', project.id);
  } catch (error) {
    console.error('Error indexing project in Redis:', error);
    throw new Error(`Failed to index project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get project by ID
export async function getProjectById(id: string): Promise<Project | null> {
  try {
    // Try JSON first
    const project = await redis.json.get(`project:${id}`) as Project | null;
    if (project) {
      return project;
    }
  } catch (jsonError) {
    console.log(`Failed to get project ${id} as JSON, trying as string:`, jsonError);
  }
  
  // Try as string
  try {
    const projectStr = await redis.get(`project:${id}`) as string | null;
    if (projectStr && typeof projectStr === 'string') {
      return JSON.parse(projectStr) as Project;
    }
  } catch (error) {
    console.error(`Failed to get project ${id}:`, error);
  }
  
  return null;
}

// Get projects by assignee
export async function getProjectsByAssignee(userId: string): Promise<Project[]> {
  const projectIds = await redis.smembers(`idx:project:assignee:${userId}`)
  if (!projectIds || projectIds.length === 0) return []
  
  const projects = await Promise.all(
    projectIds.map(id => redis.json.get(`project:${id}`) as Promise<Project>)
  )
  
  return projects.filter(Boolean) as Project[]
}

// Get projects by creator
export async function getProjectsByCreator(userId: string): Promise<Project[]> {
  const projectIds = await redis.smembers(`idx:project:creator:${userId}`)
  if (!projectIds || projectIds.length === 0) return []
  
  const projects = await Promise.all(
    projectIds.map(id => redis.json.get(`project:${id}`) as Promise<Project>)
  )
  
  return projects.filter(Boolean) as Project[]
}

// Get all projects
export async function getAllProjects(): Promise<Project[]> {
  try {
    console.log('🔍 getAllProjects: Starting to fetch all projects');
    
    // First try the global set
    let ids = await redis.smembers('projects:all');
    console.log(`🔍 getAllProjects: Found ${ids?.length || 0} project IDs in projects:all set`);
    
    // If empty, try scanning for project keys
    if (!ids || ids.length === 0) {
      console.log('🔍 getAllProjects: projects:all is empty, scanning for project:* keys');
      const keys = await redis.keys('project:*');
      console.log(`🔍 getAllProjects: Found ${keys.length} project keys`);
      
      if (keys.length > 0) {
        ids = keys.map(k => k.replace('project:', ''));
        
        // Also rebuild the projects:all set for next time
        console.log('🔍 getAllProjects: Rebuilding projects:all set');
        for (const id of ids) {
          await redis.sadd('projects:all', id);
        }
      }
    }
    
    if (!ids || ids.length === 0) {
      console.log('🔍 getAllProjects: No project IDs found');
      return [];
    }

    // Fetch projects individually instead of using pipeline
    const projects: Project[] = [];
    
    // ✅ STABLE & VERIFIED — DO NOT MODIFY WITHOUT CODE REVIEW
    // Handle Redis key type mismatches gracefully
    for (const id of ids) {
      try {
        // Try to get as JSON first
        const project = await redis.json.get(`project:${id}`) as Project;
        if (project) {
          projects.push(project);
        } else {
          console.log(`🔍 getAllProjects: Project ${id} returned null`);
        }
      } catch (error: any) {
        // Check if it's a WRONGTYPE error
        if (error?.message?.includes('WRONGTYPE')) {
          // This is expected when the key exists but is not JSON type
          // Try to get as string silently
          try {
            const projectStr = await redis.get(`project:${id}`) as string | null;
            if (projectStr && typeof projectStr === 'string') {
              const project = JSON.parse(projectStr) as Project;
              projects.push(project);
              console.log(`🔍 getAllProjects: Successfully retrieved ${id} as string`);
            }
          } catch (parseError) {
            console.log(`🔍 getAllProjects: Failed to parse project ${id} as string:`, parseError);
          }
        } else {
          // Log other types of errors
          console.log(`🔍 getAllProjects: Failed to fetch project ${id}:`, error);
        }
      }
    }
    
    console.log(`🔍 getAllProjects: Returning ${projects.length} valid projects`);
    
    return projects;
  } catch (error) {
    console.error('❌ getAllProjects: Error fetching all projects:', error);
    return [];
  }
}

// Rebuild the project indexes if needed
export async function rebuildProjectIndexes(): Promise<void> {
  try {
    console.log('Rebuilding project indexes');
    
    // Get all projects directly
    const keys = await redis.keys('project:*');
    if (!keys || keys.length === 0) {
      console.log('No projects found to reindex');
      return;
    }
    
    const projects = await Promise.all(
      keys.map(key => redis.json.get(key) as Promise<Project>)
    );
    
    const validProjects = projects.filter(Boolean) as Project[];
    console.log(`Found ${validProjects.length} projects to reindex`);
    
    // Clear existing indexes first
    await Promise.all([
      redis.del('idx:project:stage:*'),
      redis.del('idx:project:priority:*'),
      redis.del('idx:project:twitter:*'),
    ]);
    
    // Rebuild the indexes for each project
    for (const project of validProjects) {
      // Index by stage
      await redis.sadd(`idx:project:stage:${project.stage}`, project.id);
      
      // Index by priority
      await redis.sadd(`idx:project:priority:${project.priority}`, project.id);
      
      // Index by assignee (normalize if it's a Twitter handle)
      if (project.assignedTo) {
        const normalizedAssignee = project.assignedTo.replace('@', '').toLowerCase();
        await redis.sadd(`idx:project:assignee:${normalizedAssignee}`, project.id);
        // Also keep the original for backwards compatibility
        await redis.sadd(`idx:project:assignee:${project.assignedTo}`, project.id);
      }
      
      // Index by creator (normalize if it's a Twitter handle)
      const normalizedCreator = project.createdBy.replace('@', '').toLowerCase();
      await redis.sadd(`idx:project:creator:${normalizedCreator}`, project.id);
      // Also keep the original for backwards compatibility
      await redis.sadd(`idx:project:creator:${project.createdBy}`, project.id);
      
      // Index by Twitter handle (case insensitive)
      const normalizedHandle = project.twitterHandle.toLowerCase().replace('@', '');
      await redis.sadd(`idx:project:twitter:${normalizedHandle}`, project.id);
      
      // Add to global set for quick 'all' retrieval
      await redis.sadd('projects:all', project.id);
    }
    
    console.log('Project indexing completed successfully');
  } catch (error) {
    console.error('Error rebuilding project indexes:', error);
  }
}

// Check if a project with the given Twitter handle exists
export async function checkProjectExists(twitterHandle: string): Promise<boolean> {
  const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
  const projectIds = await redis.smembers(`idx:project:twitter:${normalizedHandle}`)
  return projectIds && projectIds.length > 0
}

// Update project status
export async function updateProject(id: string, updates: Partial<Project>, updatedBy: string): Promise<Project | null> {
  try {
    const project = await getProjectById(id);
    if (!project) return null;
    
    // If stage is changing, update indices
    if (updates.stage && updates.stage !== project.stage) {
      await redis.srem(`idx:project:stage:${project.stage}`, id);
      await redis.sadd(`idx:project:stage:${updates.stage}`, id);
    }
    
    // If priority is changing, update indices
    if (updates.priority && updates.priority !== project.priority) {
      await redis.srem(`idx:project:priority:${project.priority}`, id);
      await redis.sadd(`idx:project:priority:${updates.priority}`, id);
    }
    
    // If assignee is changing, update indices
    if (updates.assignedTo !== undefined && updates.assignedTo !== project.assignedTo) {
      if (project.assignedTo) {
        const oldNormalizedAssignee = project.assignedTo.replace('@', '').toLowerCase();
        await redis.srem(`idx:project:assignee:${oldNormalizedAssignee}`, id);
        await redis.srem(`idx:project:assignee:${project.assignedTo}`, id);
      }
      if (updates.assignedTo) {
        const newNormalizedAssignee = updates.assignedTo.replace('@', '').toLowerCase();
        await redis.sadd(`idx:project:assignee:${newNormalizedAssignee}`, id);
        await redis.sadd(`idx:project:assignee:${updates.assignedTo}`, id);
      }
    }
    
    // If Twitter handle is changing, update index
    if (updates.twitterHandle && updates.twitterHandle !== project.twitterHandle) {
      const oldNormalizedHandle = project.twitterHandle.toLowerCase().replace('@', '');
      await redis.srem(`idx:project:twitter:${oldNormalizedHandle}`, id);
      
      const newNormalizedHandle = updates.twitterHandle.toLowerCase().replace('@', '');
      await redis.sadd(`idx:project:twitter:${newNormalizedHandle}`, id);
    }
    
    // Ensure website has https:// if provided
    if (updates.website && !updates.website.match(/^https?:\/\//i)) {
      updates.website = `https://${updates.website}`;
    }
    
    // Update project data
    const updatedProject = { 
      ...project, 
      ...updates, 
      updatedAt: new Date().toISOString(),
      updatedBy
    };
    
    // Ensure data is clean by stringifying and parsing
    const cleanProject = JSON.parse(JSON.stringify(updatedProject));
    await redis.json.set(`project:${id}`, '$', cleanProject);
    
    console.log(`Project updated successfully: ${id} (${project.twitterHandle})`);
    return updatedProject;
  } catch (error) {
    console.error('Error updating project in Redis:', error);
    console.error('Project ID:', id, 'Updates:', updates);
    throw new Error(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Delete project
export async function deleteProject(id: string): Promise<boolean> {
  const project = await getProjectById(id)
  if (!project) return false

  // Remove from indices
  await redis.srem(`idx:project:stage:${project.stage}`, id)
  await redis.srem(`idx:project:priority:${project.priority}`, id)
  
  if (project.assignedTo) {
    const normalizedAssignee = project.assignedTo.replace('@', '').toLowerCase();
    await redis.srem(`idx:project:assignee:${normalizedAssignee}`, id)
    await redis.srem(`idx:project:assignee:${project.assignedTo}`, id)
  }
  
  const normalizedCreator = project.createdBy.replace('@', '').toLowerCase();
  await redis.srem(`idx:project:creator:${normalizedCreator}`, id)
  await redis.srem(`idx:project:creator:${project.createdBy}`, id)
  
  const normalizedHandle = project.twitterHandle.toLowerCase().replace('@', '');
  await redis.srem(`idx:project:twitter:${normalizedHandle}`, id)
  
  // Delete the project
  await redis.del(`project:${id}`)
  await redis.srem('projects:all', id)
  
  return true
}

// Get project by Twitter handle
export async function getProjectByHandle(twitterHandle: string): Promise<Project | null> {
  try {
    const normalizedHandle = twitterHandle.toLowerCase().replace('@', '');
    const projectIds = await redis.smembers(`idx:project:twitter:${normalizedHandle}`);
    
    if (!projectIds || projectIds.length === 0) {
      return null;
    }
    
    // Get the first project with this handle
    const project = await redis.json.get(`project:${projectIds[0]}`);
    return project as Project;
  } catch (error) {
    console.error(`Error getting project by handle ${twitterHandle}:`, error);
    return null;
  }
} 