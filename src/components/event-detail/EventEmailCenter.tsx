import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Mail } from "lucide-react";
import EventEmailAudit from "./EventEmailAudit";
import EmailTemplateEditor from "./EmailTemplateEditor";

interface Props {
  eventId: string;
  eventName: string;
}

export default function EventEmailCenter({ eventId, eventName }: Props) {
  return (
    <Tabs defaultValue="audit" className="space-y-5">
      <TabsList className="bg-muted rounded-full p-1 w-full sm:w-auto">
        <TabsTrigger
          value="audit"
          className="flex-1 sm:flex-initial rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm"
        >
          <ClipboardList className="w-3.5 h-3.5 mr-1.5" /> Auditoria
        </TabsTrigger>
        <TabsTrigger
          value="templates"
          className="flex-1 sm:flex-initial rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm"
        >
          <Mail className="w-3.5 h-3.5 mr-1.5" /> Templates
        </TabsTrigger>
      </TabsList>

      <TabsContent value="audit" className="mt-0">
        <EventEmailAudit eventId={eventId} eventName={eventName} />
      </TabsContent>
      <TabsContent value="templates" className="mt-0">
        <EmailTemplateEditor eventId={eventId} />
      </TabsContent>
    </Tabs>
  );
}
