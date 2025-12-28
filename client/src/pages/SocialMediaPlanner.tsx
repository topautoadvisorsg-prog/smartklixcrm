import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Share2, ImageIcon, Bell } from "lucide-react";
import { SiFacebook, SiInstagram, SiLinkedin, SiX } from "react-icons/si";

export default function SocialMediaPlanner() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Social Media Planner</h1>
          <p className="text-muted-foreground">Schedule and manage posts across all your social media accounts</p>
        </div>
        <Badge variant="secondary" data-testid="badge-coming-soon">
          Coming Soon
        </Badge>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
            <div className="p-4 rounded-full bg-primary/10">
              <Share2 className="w-10 h-10 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Social Media Planner is in Development</h2>
              <p className="text-muted-foreground">
                We're building a powerful tool to help you schedule posts, manage content, and grow your social presence - all from one place.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 py-4">
              <div className="p-3 rounded-full bg-muted">
                <SiFacebook className="w-6 h-6" />
              </div>
              <div className="p-3 rounded-full bg-muted">
                <SiInstagram className="w-6 h-6" />
              </div>
              <div className="p-3 rounded-full bg-muted">
                <SiLinkedin className="w-6 h-6" />
              </div>
              <div className="p-3 rounded-full bg-muted">
                <SiX className="w-6 h-6" />
              </div>
            </div>

            <Button variant="outline" data-testid="button-notify-me">
              <Bell className="w-4 h-4 mr-2" />
              Notify Me When Ready
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="p-2 rounded-md bg-primary/10 w-fit">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-base mb-1">Visual Calendar</CardTitle>
            <CardDescription>
              Plan your content with a drag-and-drop calendar view. See your entire social strategy at a glance.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="p-2 rounded-md bg-primary/10 w-fit">
              <Clock className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-base mb-1">Smart Scheduling</CardTitle>
            <CardDescription>
              AI-powered suggestions for the best times to post based on your audience engagement patterns.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="p-2 rounded-md bg-primary/10 w-fit">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-base mb-1">Media Library</CardTitle>
            <CardDescription>
              Store and organize all your images, videos, and graphics in one central location.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
