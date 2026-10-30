import { useEffect, useState } from 'react';

const URL = 'https://marnico.app.n8n.cloud/webhook/dwight-status';

export default function DwightEstadoN8n() {
      const [estado, setEstado] = useState('Conectando...');

        useEffect(() => {
                let activo = true;

                    async function consultar() {
                              try {
                                        const respuesta = await fetch(URL, { cache: 'no-store' });
                                                if (!respuesta.ok) throw new Error('Error HTTP');
                                                        const datos = await respuesta.json();
                                                                if (activo) {
                                                                              setEstado(
                                                                                            datos.estado + (datos.tiene_alertas ? ' - Alertas' : '')
                                                                              );
                                                                }
                              } catch {
                                        if (activo) setEstado('Sin conexión');
                              }
                    }

                        consultar();
                            const intervalo = setInterval(consultar, 15000);
                                return () => {
                                          activo = false;
                                                clearInterval(intervalo);
                                };
        }, []);

          return (
                <div role="status" style={{
                          position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
                                background: '#182238', color: 'white', padding: 12,
                                      borderRadius: 12
                }}>
                      Dwight CPFR: {estado}
                          </div>
          );
}