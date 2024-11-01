"use client"

import * as React from "react"
import { Brain, FileText, MessageSquare, Search, ThumbsUp } from "lucide-react"
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Command } from 'cmdk'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { X, Filter, ChevronDown } from 'lucide-react'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CreateContentDialog } from "@/components/create-content-dialog"
import { Label } from "@/components/ui/label"
import { getContentByFilter, getProjects } from '@/server/queries'
import { Button } from "@/components/ui/button"
interface ContentBrowserProps {
  initialType?: 'discussion' | 'hypothesis' | 'educational'
  projectId?: string
}


export function ContentBrowser({ initialType = 'discussion', projectId }: ContentBrowserProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Watch for URL parameter changes and update the state
  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Handle content type
      const typeParam = searchParams.get('type') as typeof initialType
      if (typeParam && ['discussion', 'hypothesis', 'educational'].includes(typeParam)) {
        setSelectedType(typeParam)
      }
      
      // Handle sort
      const sortParam = searchParams.get('sort') as typeof sortBy
      if (sortParam && ['recent', 'popular', 'views'].includes(sortParam)) {
        setSortBy(sortParam)
      }
      
      // Handle project
      const projectParam = searchParams.get('projectId')
      if (projectParam) {
        setSelectedProject(projectParam)
      }
      
      // Handle search
      const searchParam = searchParams.get('search')
      if (searchParam) {
        setSearchQuery(searchParam)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchParams])

  const [selectedType, setSelectedType] = React.useState(
    searchParams.get('type') as typeof initialType || initialType
  )
  const [selectedProject, setSelectedProject] = React.useState(projectId || 'all')
  const [sortBy, setSortBy] = React.useState<'recent' | 'popular' | 'views'>(
    (searchParams.get('sort') || 'recent') as 'recent' | 'popular' | 'views'
  )
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('search') || '')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [contents, setContents] = React.useState<Awaited<ReturnType<typeof getContentByFilter>>>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [projects, setProjects] = React.useState<{ id: string, projectName: string }[]>([])
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const [projectSearch, setProjectSearch] = React.useState('')

  const filteredProjects = projects.filter((project) =>
    project.projectName.toLowerCase().includes(projectSearch.toLowerCase())
  )

  // New fetchContent function
  const fetchContent = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getContentByFilter({
        type: selectedType,
        projectId: selectedProject !== 'all' ? selectedProject : undefined,
        search: searchQuery || undefined,
        sort: sortBy === 'views' ? 'recent' : sortBy
      })
      setContents(data as Awaited<ReturnType<typeof getContentByFilter>>)
    } catch (error) {
      console.error('Error fetching content:', error)
      toast.error('Failed to load content')
    } finally {
      setIsLoading(false)
    }
  }, [selectedType, selectedProject, searchQuery, sortBy])

  // Update the useEffect to use fetchContent
  React.useEffect(() => {
    fetchContent()
  }, [fetchContent])

  // Add useEffect to fetch projects when component mounts
  React.useEffect(() => {
    async function fetchProjects() {
      try {
        const projectsData = await getProjects()
        setProjects(projectsData.map(p => ({
          id: p.id.toString(),
          projectName: p.name
        })))
      } catch (error) {
        console.error('Error fetching projects:', error)
        toast.error('Failed to load projects')
      }
    }

    fetchProjects()
  }, [])

  const getContentIcon = (type: string) => {
    if (type === 'discussion') return <MessageSquare className="h-4 w-4" />
    if (type === 'hypothesis') return <Brain className="h-4 w-4" />
    if (type === 'educational') return <FileText className="h-4 w-4" /> 
    return null
  }

  // Add URL update function
  const updateURL = React.useCallback((params: Record<string, string>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newSearchParams.set(key, value)
      } else {
        newSearchParams.delete(key)
      }
    })
    router.push(`?${newSearchParams.toString()}`, { scroll: false })
  }, [searchParams, router])

  // Update handlers to modify URL
  const handleTypeChange = (value: typeof selectedType) => {
    setSelectedType(value)
    updateURL({ type: value })
  }

  const handleSortChange = (value: typeof sortBy) => {
    setSortBy(value)
    updateURL({ sort: value })
  }

  const handleProjectChange = (value: string) => {
    setSelectedProject(value)
    updateURL({ projectId: value })
  }

  // Update dialog state handler to update URL
  const handleDialogChange = (open: boolean) => {
    setIsCreateDialogOpen(open)   
  }

  // Add search handler to update URL
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    updateURL({ search: value || '' })
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between flex-col lg:flex-row lg:space-y-0 space-y-4 items-center mb-6">
        {/* Content type tabs */}
        <Tabs 
          defaultValue={selectedType} 
          value={selectedType} 
          onValueChange={handleTypeChange as (value: string) => void}
          className="xl:w-1/3 lg:w-1/2 w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="discussion">Discussions</TabsTrigger>
            <TabsTrigger value="hypothesis">Hypotheses</TabsTrigger>
            <TabsTrigger value="educational">Educational</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Project selection */}
        <div className="flex items-center space-x-4">

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between min-w-[200px] max-w-[300px]">
                  {selectedProject === 'all' ? 'All Projects' : projects.find(p => p.id === selectedProject)?.projectName || 'Select Project'}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[300px]">
                <Command>
                  <Input
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="border-none focus:ring-0 mb-2"
                  />
                  <ul className="max-h-[300px] overflow-y-auto">
                    <li 
                      key="all" 
                      className="cursor-pointer px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground" 
                      onClick={() => handleProjectChange('all')}
                    >
                      All Projects
                    </li>
                    {filteredProjects.map((project) => (
                      <li
                        key={project.id}
                        className="cursor-pointer px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleProjectChange(project.id)}
                      >
                        {project.projectName}
                      </li>
                    ))}
                  </ul>
                </Command>
              </PopoverContent>
            </Popover>

        {/* Filter and search */}
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            aria-label="Toggle filters"
          >
            <Filter className="h-4 w-4" />
          </Button>
          {isFilterOpen && (
            <div className="absolute right-0 mt-2 w-72 z-10">
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Filters</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsFilterOpen(false)}
                      className="h-6 w-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sortBy">Sort by</Label>
                      <Select value={sortBy} onValueChange={handleSortChange}>
                        <SelectTrigger id="sortBy">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recent">Most Recent</SelectItem>
                          <SelectItem value="popular">Most Popular</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="search">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        <CreateContentDialog
          open={isCreateDialogOpen}
          onOpenChange={handleDialogChange}
          type={selectedType}
          projectId={selectedProject !== 'all' ? selectedProject : undefined}
          projects={projects}
          onSuccess={fetchContent}
          defaultProjectId={projectId}
        />
      </div>
      </div>

      {/* Content cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Create New Card - Always shown first */}
        <Card 
          className="border-dashed border-2 bg-muted/50 hover:bg-muted/80 cursor-pointer transition-colors"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="rounded-full bg-primary/10 p-4">
              {getContentIcon(selectedType)}
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Create New {selectedType}</h3>
              <p className="text-sm text-muted-foreground">
                Share your thoughts and contribute to the community!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Existing Content Cards */}
        {contents.map((content) => (
          <Card 
            key={content.id} 
            className="flex flex-col cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/${content.type}/${content.id}`)}
          >
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar>
                <AvatarImage src={`https://avatar.vercel.sh/${content.author!.name || 'Guest'}`} alt={content.author!.name || 'Guest'} />
              </Avatar>
              <div className="flex flex-col">
                <CardTitle className="text-lg">{content.author!.name}</CardTitle>
                <CardDescription>{new Date(content.createdAt).toLocaleDateString()}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <h3 className="text-xl font-semibold mb-2">{content.title}</h3>
              <div className="flex space-x-2 mb-2">
                <Badge>
                  {getContentIcon(content.type)}
                  <span className="ml-1">
                    {content.type}
                  </span>
                </Badge>
                {content.projectId && (
                  <Badge variant="secondary">{content.project?.projectName}</Badge>
                )}
              </div>
              <p className="text-muted-foreground line-clamp-3">{content.content}</p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex space-x-4 text-muted-foreground">
                <span className="flex items-center">
                  <MessageSquare className="mr-1 h-4 w-4" />
                  {content._count.comments}
                </span>
                <span className="flex items-center">
                  <ThumbsUp className="mr-1 h-4 w-4" />
                  {content._count.upvotes}
                </span>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Guidelines</CardTitle>
            <CardDescription>
              Please follow these guidelines to ensure a productive and respectful discussion environment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <ul className="list-disc pl-6 space-y-2">
                <li>Be respectful and courteous to all participants.</li>
                <li>Stay on topic and contribute meaningfully to discussions.</li>
                <li>Avoid sharing personal medical advice; consult with healthcare professionals.</li>
                <li>Respect intellectual property and cite sources when referencing research or data.</li>
                <li>Use clear and concise language to facilitate understanding.</li>
                <li>Be open to different perspectives and experiences.</li>
                <li>Report any inappropriate content or behavior to moderators.</li>
                <li>Protect your privacy and that of others; avoid sharing sensitive personal information.</li>
                <li>Use appropriate tags to categorize your discussions for easier navigation.</li>
                <li>Engage in constructive debates and avoid personal attacks.</li>
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
