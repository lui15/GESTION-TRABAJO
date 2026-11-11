package es.gestiontrabajo.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Dice a la app si Firebase está configurado (si se compiló con google-services.json).
 *
 * Sin ese archivo, PushNotifications.register() cierra la app. El plugin de
 * google-services genera el recurso "google_app_id" solo cuando el archivo existe,
 * así que basta con buscarlo, sin depender de las clases de Firebase.
 */
@CapacitorPlugin(name = "EstadoFirebase")
public class EstadoFirebasePlugin extends Plugin {

    @PluginMethod
    public void estado(PluginCall call) {
        int id = getContext()
            .getResources()
            .getIdentifier("google_app_id", "string", getContext().getPackageName());

        JSObject resultado = new JSObject();
        resultado.put("configurado", id != 0);
        call.resolve(resultado);
    }
}
