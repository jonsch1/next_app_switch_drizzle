"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Brain, FileText, MessageSquare, ThumbsUp, Video, Users, ExternalLink, MoreVertical, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import { toast } from 'sonner'
import { useState } from 'react'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from '@/components/ui/spinner'
import { getContentWithComments } from "@/server/queries"
import { createComment, updateComment, deleteComment, toggleContentUpvote, toggleCommentUpvote, updateContent, deleteContent } from "@/server/mutations"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(1000, "Comment is too long (max 1000 characters)"),
})

type CommentFormData = z.infer<typeof commentSchema>

// First, add the content form schema at the top of the file
const contentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  evidence: z.string().optional(),
  experiment: z.string().optional(),
  resourceUrl: z.string().url().optional().or(z.literal('')),
})

type ContentFormData = z.infer<typeof contentSchema>

// Add this type definition
type CommentType = {
  id: number
  text: string
  author: {
    id: number | null
    username: string | null
  }
  createdAt: string
  parentId: number | null
  upvotes: any[]
  replies: CommentType[]
}

// Add this helper function to transform flat comments into nested structure
const buildCommentTree = (comments: any[]): CommentType[] => {
  const commentMap = new Map()
  const roots: CommentType[] = []

  // First pass: Create all comment objects and store in map
  comments.forEach(comment => {
    commentMap.set(comment.id, {
      ...comment,
      replies: []
    })
  })

  // Second pass: Build the tree structure
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id)
    if (comment.parentId === null) {
      roots.push(commentWithReplies)
    } else {
      const parent = commentMap.get(comment.parentId)
      if (parent) {
        parent.replies.push(commentWithReplies)
      }
    }
  })

  return roots
}

export function ContentViewer({ contentId }: { contentId: string }) {
  const router = useRouter()
  const [content, setContent] = React.useState<Awaited<ReturnType<typeof getContentWithComments>> | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [votes, setVotes] = React.useState<{
    content: boolean;
    comments: Record<string, boolean>;
  }>({
    content: false,
    comments: {},
  })
  const [editingComment, setEditingComment] = React.useState<string | null>(null)
  const [editingContent, setEditingContent] = React.useState(false)
  const [session, setSession] = React.useState<any>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  })

  // Inside ContentViewer component, add a new form instance for content editing
  const contentForm = useForm<ContentFormData>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: content?.title || "",
      content: content?.content || "",
    },
  })
  console.log(content?.comments)

  // Fetch content data
  React.useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true)
      try {
        const data = await getContentWithComments(parseInt(contentId))
        if (!data) throw new Error('Content not found')
        
        // Initialize votes state based on upvotes arrays
        setVotes({
          content: data.upvotes.some(v => v.userId.toString() === session?.user?.id.toString()),
          comments: Object.fromEntries(
            data.comments.map(comment => [
              comment.id, 
              comment.upvotes.some(v => v.userId.toString() === session?.user?.id.toString())
            ])
          )
        })
        
        setContent(data)
      } catch (error) {
        console.error('Error fetching content:', error)
        toast.error('Failed to load content')
      } finally {
        setIsLoading(false)
      }
    }

    loadContent()
  }, [contentId, session?.user?.id])

  // Add this effect to fetch session
  React.useEffect(() => {
    const loadSession = async () => {
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      setSession(data)
    }
    loadSession()
  }, [])

  const getContentIcon = () => {
    if (!content) return null
    switch (content.type) {
      case 'discussion':
        return <MessageSquare className="h-4 w-4" />
      case 'hypothesis':
        return <Brain className="h-4 w-4" />
      case 'educational':
        return <FileText className="h-4 w-4" />
    }
  }

  // Add this effect to update form defaults when content changes
  React.useEffect(() => {
    if (content) {
      contentForm.reset({
        title: content.title,
        content: content.content,
      })
    }
  }, [content, contentForm])

  if (isLoading) return (        <div className="absolute inset-0 flex items-center justify-center">
    <LoadingSpinner size={40} />
  </div>)
  if (!content) return <div>Content not found</div>

  const handleEditContent = async (values: ContentFormData) => {
    try {
      const updatedContent = await updateContent(parseInt(contentId), values)
      setContent(prev => prev ? { ...prev, ...updatedContent[0] } : null)
      setEditingContent(false)
      toast.success('Content updated successfully')
    } catch (error) {
      console.error(error)
      toast.error('Failed to update content')
    }
  }
  const handleDeleteContent = async () => {
    try {
      await deleteContent(parseInt(contentId))
      toast.success('Content deleted successfully')
      router.push('/') // or wherever your content list page is
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete content')
    }
  }
  const handleEditComment = async (commentId: string, values: CommentFormData) => {
    try {
      const updatedComment = await updateComment(parseInt(commentId), values.content)
      
      // Update local state
      setContent(prev => prev ? {
        ...prev,
        comments: prev.comments.map(comment => 
          comment.id === parseInt(commentId)
            ? { ...comment, text: values.content }
            : comment
        )
      } : null)
      
      setEditingComment(null)
      toast.success('Comment updated successfully')
    } catch (error) {
      console.error(error)
      toast.error('Failed to update comment')
    }
  }
  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(parseInt(commentId))
      
      // Update local state
      setContent(prev => prev ? {
        ...prev,
        comments: prev.comments.filter(comment => 
          comment.id !== parseInt(commentId)
        )
      } : null)
      
      toast.success('Comment deleted successfully')
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete comment')
    }
  }
  const handleVote = async (commentId?: string) => {
    try {
      if (!session?.user?.id) {
        toast.error('Please sign in to vote')
        return
      }

      if (commentId) {
        // Handle comment vote
        const isUpvoted = await toggleCommentUpvote(parseInt(commentId), parseInt(session.user.id))
        setVotes(prev => ({
          ...prev,
          comments: {
            ...prev.comments,
            [commentId]: isUpvoted
          }
        }))

        // Update comment upvotes in content state
        setContent(prev => {
          if (!prev) return null
          return {
            ...prev,
            comments: prev.comments.map(comment => {
              if (comment.id.toString() === commentId) {
                const currentUpvotes = comment.upvotes || []
                if (isUpvoted) {
                  return {
                    ...comment,
                    upvotes: [...currentUpvotes, {
                      id: Date.now(),
                      userId: parseInt(session.user.id),
                      entityType: 'comment',
                      entityId: parseInt(commentId),
                      upvotedAt: new Date()
                    }]
                  }
                } else {
                  return {
                    ...comment,
                    upvotes: currentUpvotes.filter(u => u.userId !== parseInt(session.user.id))
                  }
                }
              }
              return comment
            })
          }
        })
      } else {
        // Handle content vote
        const isUpvoted = await toggleContentUpvote(parseInt(contentId), parseInt(session.user.id))
        setVotes(prev => ({
          ...prev,
          content: isUpvoted
        }))
        
        // Update the content's upvotes count
        setContent(prev => {
          if (!prev) return null
          const currentUpvotes = prev.upvotes || []
          if (isUpvoted) {
            return {
              ...prev,
              upvotes: [...currentUpvotes, {
                id: Date.now(), // temporary ID
                userId: parseInt(session.user.id),
                entityType: 'content',
                entityId: parseInt(contentId),
                upvotedAt: new Date()
              }]
            }
          } else {
            return {
              ...prev,
              upvotes: currentUpvotes.filter(u => u.userId !== parseInt(session.user.id))
            }
          }
        })
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to update vote')
    }
  }
  const handleReply = async (commentId: string, values: CommentFormData) => {
    try {
      const newReply = await createComment({
        contentId: parseInt(contentId), 
        text: values.content,
        parentId: parseInt(commentId)
      })
      
      setContent(prev => prev ? {
        ...prev,
        comments: [...prev.comments, {
          ...newReply[0],
          author: session.user,
          upvotes: []
        }]
              } : null)
      form.reset()
      toast.success('Reply posted successfully')
    } catch (error) {
      console.error(error)
      toast.error('Failed to post reply')
    }
  }
  const onSubmit = async (values: CommentFormData) => {
    try {
      const newComment = await createComment({
        contentId: parseInt(contentId),
        text: values.content,
        parentId: null
      })
      
      setContent(prev => prev ? {
        ...prev,
        comments: [...prev.comments, {
          ...newComment[0],
          author: session.user,
          upvotes: []
        }]
      } : null)
      
      form.reset()
      toast.success('Comment posted successfully')
    } catch (error) {
      console.error(error)
      toast.error('Failed to post comment')
    }
  }
  return (
    <div className="container mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{content.title}</CardTitle>
              <CardDescription>
                Posted by {content.author.username} on {new Date(content.createdAt).toLocaleDateString()}
                {content.project && (
                  <> in project <span className="font-medium">{content.project.projectName}</span></>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Avatar>
                <AvatarImage src={`https://avatar.vercel.sh/${content.author.username || 'Guest'}`} alt={content.author.username || 'Guest'} />
              </Avatar>
              {session?.user?.id.toString() === content.author.id!.toString() && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingContent(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>{content.content}</p>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleVote()}
                className={votes.content ? 'bg-green-100' : ''}
              >
                <ThumbsUp className="mr-2 h-4 w-4" />
                {content.upvotes.length}
              </Button>
              <Badge variant="outline">
                {getContentIcon()}
                <span className="ml-2">
                  {content.type}
                </span>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit content dialog */}
      <Dialog open={editingContent} onOpenChange={setEditingContent}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
          </DialogHeader>
          <Form {...contentForm}>
            <form onSubmit={contentForm.handleSubmit(handleEditContent)} className="space-y-4">
              <FormField
                control={contentForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contentForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[100px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setEditingContent(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Comments section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Discussion</CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" onClick={() => {
                  if (!session?.user?.id) {
                    toast.error('Please sign in to comment')
                    return
                  }
                }}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Comment
                </Button>
              </PopoverTrigger>
              {session?.user?.id && (
                <PopoverContent className="w-96">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your comment</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Share your thoughts or insights..."
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button type="submit">Post Comment</Button>
                      </div>
                    </form>
                  </Form>
                </PopoverContent>
              )}
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[550px] pr-4">
            {buildCommentTree(content?.comments || []).map((comment) => (
              <CommentComponent
                key={comment.id}
                comment={comment}
                session={session}
                onReply={handleReply}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
                onVote={handleVote}
                votes={votes.comments}
              />
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post
              and all its comments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteContent}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CommentComponent({ 
  comment, 
  depth = 0,
  session,
  onReply,
  onEdit,
  onDelete,
  onVote,
  votes
}: { 
  comment: CommentType
  depth?: number
  session: any
  onReply: (commentId: string, values: CommentFormData) => Promise<void>
  onEdit: (commentId: string, values: CommentFormData) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  onVote: (commentId: string) => Promise<void>
  votes: Record<string, boolean>
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const replyForm = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" }
  })

  // Add this to initialize the edit form with the comment text
  const editForm = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: comment.text }
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
  console.log(session?.user?.id)
  return (
    <div className={`relative ${depth > 0 ? 'ml-6' : ''}`}>
      {depth > 0 && comment.replies.length > 0 && (
        <div 
          className="absolute left-[-24px] top-0 h-full cursor-pointer"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand comment" : "Collapse comment"}
        >
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" />
          <div className="absolute left-1/2 top-4 w-3 h-0.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" />
        </div>
      )}
      <div className="flex items-start gap-4 p-4 mb-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                <AvatarImage src={`https://avatar.vercel.sh/${comment.author.username}`} alt={comment.author.username || 'Anonymous'} />
                <AvatarFallback>{comment.author.username?.[0].toUpperCase() || 'A'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{comment.author.username || 'Anonymous'}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comment.createdAt)}</span>
              </div>
            </div>
            {session?.user?.id.toString() === comment.author.id!.toString() && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(comment.id.toString())} className="cursor-pointer text-red-600 dark:text-red-400">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {!isCollapsed && (
            <>
              {isEditing ? (
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit((values) => {
                    onEdit(comment.id.toString(), values)
                    setIsEditing(false)
                  })} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              {...field}
                              className="resize-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-x-2">
                      <Button type="submit" size="sm">Save</Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <>
                  <p className="text-sm mb-3 leading-relaxed">{comment.text}</p>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onVote(comment.id.toString())}
                      className={`${votes[comment.id] ? 'bg-green-100 hover:bg-green-200' : ''}`}
                    >
                      <ThumbsUp className={`mr-2 h-4 w-4 ${votes[comment.id] ? 'text-green-600' : ''}`} />
                      {comment.upvotes.length}
                    </Button>
                    <Popover open={isReplying} onOpenChange={setIsReplying}>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            if (!session?.user?.id) {
                              toast.error('Please sign in to reply')
                              return
                            }
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Reply
                        </Button>
                      </PopoverTrigger>
                      {session?.user?.id && (
                        <PopoverContent className="w-80">
                          <Form {...replyForm}>
                            <form onSubmit={replyForm.handleSubmit((values) => {
                              onReply(comment.id.toString(), values)
                              setIsReplying(false)
                            })} className="space-y-4">
                              <Textarea 
                                {...replyForm.register('content')}
                                placeholder="Write your reply..." 
                                className="mb-2 resize-none" 
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsReplying(false)}>Cancel</Button>
                                <Button size="sm" type="submit">Post Reply</Button>
                              </div>
                            </form>
                          </Form>
                        </PopoverContent>
                      )}
                    </Popover>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {!isCollapsed && comment.replies.map((reply) => (
        <CommentComponent
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          session={session}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onVote={onVote}
          votes={votes}
        />
      ))}
    </div>
  )
}
